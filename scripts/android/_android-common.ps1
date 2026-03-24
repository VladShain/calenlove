$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Convert-ToSafeArray([object]$Value) {
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) { return @([string]$Value) }
  if ($Value -is [System.Collections.IDictionary]) { return @($Value) }
  if ($Value -is [System.Array]) { return @($Value) }
  if ($Value -is [System.Collections.IEnumerable]) { return @($Value) }
  return @($Value)
}

function Get-SafeCount([object]$Value) {
  return @((Convert-ToSafeArray $Value)).Count
}

function Join-SafeItems([object]$Value, [string]$Separator = ', ') {
  $items = @()
  foreach ($item in (Convert-ToSafeArray $Value)) {
    $text = [string]$item
    if ([string]::IsNullOrWhiteSpace($text)) { continue }
    $items += $text
  }
  return ($items -join $Separator)
}

function New-StringList {
  return (New-Object System.Collections.ArrayList)
}

function Add-UniqueString([object]$List, [string]$Value) {
  if ($null -eq $List) { return }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return }
  if (-not ($List.Contains($text))) {
    [void]$List.Add($text)
  }
}

function Add-UniqueExistingPath([object]$List, [string]$Value) {
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return }
  if (-not (Test-Path $text)) { return }
  try { $resolved = (Resolve-Path $text).Path } catch { $resolved = $text }
  Add-UniqueString $List $resolved
}
function Resolve-PathIfExists([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  if (-not (Test-Path $Value)) { return $null }
  try { return (Resolve-Path $Value).Path } catch { return $Value }
}

function Get-ProjectRoot {
  $path = Join-Path $PSScriptRoot '..\..'
  return (Resolve-Path $path).Path
}

function Get-KeyApiPath([string]$RootPath) {
  foreach ($candidateName in @('KEY_API', 'KEY_API.txt')) {
    $candidatePath = Join-Path $RootPath $candidateName
    if (Test-Path $candidatePath) { return $candidatePath }
  }
  return (Join-Path $RootPath 'KEY_API')
}

function Read-KeyApiConfig([string]$RootPath) {
  $result = @{}
  $path = Get-KeyApiPath $RootPath
  if (-not (Test-Path $path)) { return $result }

  foreach ($rawLine in (Get-Content $path -ErrorAction SilentlyContinue)) {
    $line = ([string]$rawLine).Trim().TrimStart([char]0xFEFF)
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.StartsWith('#') -or $line.StartsWith(';') -or $line.StartsWith('//')) { continue }
    $parts = @($line -split '=', 2)
    if (@($parts).Count -lt 2) { continue }
    $key = ([string]$parts[0]).Trim().TrimStart([char]0xFEFF)
    $value = ([string]$parts[1]).Trim()
    if (-not [string]::IsNullOrWhiteSpace($key)) {
      $result[$key] = $value
    }
  }

  return $result
}

function Get-KeyApiValue($Config, [string]$Name) {
  if ($null -ne $Config -and $Config.ContainsKey($Name)) { return [string]$Config[$Name] }
  return ''
}

function Get-FirstConfigValue($Config, [string[]]$Names) {
  foreach ($name in (Convert-ToSafeArray $Names)) {
    $value = Get-KeyApiValue $Config ([string]$name)
    if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
  }
  return ''
}

function Get-CloudModeDescription($Config) {
  $url = Get-KeyApiValue $Config 'VITE_SUPABASE_URL'
  $key = Get-KeyApiValue $Config 'VITE_SUPABASE_ANON_KEY'
  if (-not [string]::IsNullOrWhiteSpace($url) -and -not [string]::IsNullOrWhiteSpace($key)) {
    return 'cloud enabled: sync can work when network is available'
  }
  return 'local mode: server optional, data stays local, apk installs through adb'
}

function Has-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CommandPathSafe([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    if ($cmd.PSObject.Properties.Name -contains 'Source' -and $cmd.Source) { return [string]$cmd.Source }
    if ($cmd.PSObject.Properties.Name -contains 'Path' -and $cmd.Path) { return [string]$cmd.Path }
    if ($cmd.PSObject.Properties.Name -contains 'Definition' -and $cmd.Definition) { return [string]$cmd.Definition }
  }

  $pathRaw = [Environment]::GetEnvironmentVariable('PATH', 'Process')
  if (-not [string]::IsNullOrWhiteSpace($pathRaw)) {
    foreach ($part in @($pathRaw -split ';')) {
      $item = [string]$part
      if ([string]::IsNullOrWhiteSpace($item)) { continue }
      $candidate = Join-Path $item $Name
      if (Test-Path $candidate) {
        try { return (Resolve-Path $candidate).Path } catch { return $candidate }
      }
    }
  }

  return $null
}

function Get-CommandVersionSafe([string]$Name, [string[]]$Arguments) {
  if (-not (Has-Command $Name)) { return '' }
  try {
    $output = & $Name @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) { return '' }
    $firstLine = Convert-ToSafeArray $output | Select-Object -First 1
    return ([string]$firstLine).Trim()
  }
  catch {
    return ''
  }
}

function Get-RustHostTriple {
  if (-not (Has-Command 'rustc')) { return '' }
  try {
    $output = & rustc -vV 2>$null
    if ($LASTEXITCODE -ne 0) { return '' }
    foreach ($line in (Convert-ToSafeArray $output)) {
      if ($line -match '^host:\s+(.+)$') { return ([string]$matches[1]).Trim() }
    }
  }
  catch {}
  return ''
}

function Test-RustHostNeedsMsvc([string]$HostTriple) {
  $triple = ([string]$HostTriple).Trim().ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($triple)) { return $true }
  return ($triple -like '*-pc-windows-msvc')
}

function Test-InternetConnection {
  try {
    $null = Invoke-WebRequest -Uri 'https://registry.npmjs.org/' -Method Head -UseBasicParsing -TimeoutSec 6
    return $true
  }
  catch {
    return $false
  }
}

function Find-AndroidSdkRoot($Config) {
  $candidates = @(
    (Get-KeyApiValue $Config 'ANDROID_SDK_ROOT'),
    (Get-KeyApiValue $Config 'ANDROID_HOME'),
    $env:ANDROID_SDK_ROOT,
    $env:ANDROID_HOME,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
    (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'),
    'C:\Android\Sdk'
  )

  foreach ($candidate in (Convert-ToSafeArray ($candidates | Where-Object { $_ } | Select-Object -Unique))) {
    if ((Test-Path $candidate) -and (Test-Path (Join-Path $candidate 'platform-tools'))) {
      try { return (Resolve-Path $candidate).Path } catch { return $candidate }
    }
  }

  return $null
}

function Find-JavaHome($Config) {
  $candidates = @(
    (Get-KeyApiValue $Config 'JAVA_HOME'),
    $env:JAVA_HOME,
    'C:\Program Files\Android\Android Studio\jbr',
    'C:\Program Files\Android\Android Studio\jre',
    'C:\Program Files\JetBrains\Android Studio\jbr'
  )

  $adoptiumRoot = 'C:\Program Files\Eclipse Adoptium'
  if (Test-Path $adoptiumRoot) {
    $candidates += (Get-ChildItem $adoptiumRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { $_.FullName })
  }

  foreach ($candidate in (Convert-ToSafeArray ($candidates | Where-Object { $_ } | Select-Object -Unique))) {
    if ((Test-Path $candidate) -and (Test-Path (Join-Path $candidate 'bin\java.exe'))) {
      try { return (Resolve-Path $candidate).Path } catch { return $candidate }
    }
  }

  return $null
}

function Find-NdkHome($Config, [string]$SdkRoot) {
  $candidates = @()
  $manualNdk = Get-KeyApiValue $Config 'NDK_HOME'
  if ($manualNdk) { $candidates += $manualNdk }
  if ($env:NDK_HOME) { $candidates += $env:NDK_HOME }
  if ($SdkRoot) {
    $ndkRoot = Join-Path $SdkRoot 'ndk'
    if (Test-Path $ndkRoot) {
      $candidates += (Get-ChildItem $ndkRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { $_.FullName })
    }
  }

  foreach ($candidate in (Convert-ToSafeArray ($candidates | Where-Object { $_ } | Select-Object -Unique))) {
    if ((Test-Path $candidate) -and (Test-Path (Join-Path $candidate 'toolchains\llvm\prebuilt'))) {
      try { return (Resolve-Path $candidate).Path } catch { return $candidate }
    }
  }

  return $null
}

function Find-SdkManager([string]$SdkRoot) {
  if ([string]::IsNullOrWhiteSpace($SdkRoot)) { return $null }

  $direct = Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
  if (Test-Path $direct) {
    try { return (Resolve-Path $direct).Path } catch { return $direct }
  }

  $cmdlineRoot = Join-Path $SdkRoot 'cmdline-tools'
  if (Test-Path $cmdlineRoot) {
    $manager = Get-ChildItem $cmdlineRoot -Recurse -Filter sdkmanager.bat -File -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -First 1
    if ($manager) { return $manager.FullName }
  }

  return $null
}

function Get-MissingAndroidSdkParts([string]$SdkRoot) {
  if ([string]::IsNullOrWhiteSpace($SdkRoot)) {
    return @('platform-tools', 'platforms', 'build-tools', 'cmdline-tools', 'ndk')
  }

  $missing = @()
  foreach ($requiredPath in @('platform-tools', 'platforms', 'build-tools', 'cmdline-tools', 'ndk')) {
    if (-not (Test-Path (Join-Path $SdkRoot $requiredPath))) {
      $missing += $requiredPath
    }
  }
  return @($missing)
}

function Convert-PackageSortKey([string]$PackageName) {
  $versionText = $PackageName -replace '^ndk;', ''
  $numbers = @($versionText -split '[^0-9]+' | Where-Object { $_ -ne '' } | ForEach-Object { '{0:D10}' -f [int]$_ })
  if (@($numbers).Count -eq 0) { return '0000000000' }
  return ($numbers -join '.')
}

function Get-LatestAvailableNdkPackage([string]$SdkManagerPath) {
  if ([string]::IsNullOrWhiteSpace($SdkManagerPath)) { return $null }
  try {
    $output = & $SdkManagerPath --list 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $packages = @()
    foreach ($line in (Convert-ToSafeArray $output)) {
      if ($line -match '^\s*(ndk;[0-9][^|\s]*)\s*(?:\||$)') {
        if ($packages -notcontains $matches[1]) { $packages += $matches[1] }
      }
    }
    if (@($packages).Count -eq 0) { return $null }
    return ($packages | Sort-Object @{ Expression = { Convert-PackageSortKey $_ }; Descending = $true } | Select-Object -First 1)
  }
  catch {
    return $null
  }
}

function Try-InstallNdk([string]$SdkManagerPath, [string]$SdkRoot) {
  $package = Get-LatestAvailableNdkPackage $SdkManagerPath
  if (-not $package) {
    return [pscustomobject]@{ Success = $false; Message = 'Failed to detect NDK package through sdkmanager --list.' }
  }

  & $SdkManagerPath --sdk_root=$SdkRoot --install $package
  if ($LASTEXITCODE -ne 0) {
    return [pscustomobject]@{ Success = $false; Message = ('Automatic NDK install failed: ' + $package) }
  }

  return [pscustomobject]@{ Success = $true; Message = ('NDK installed automatically: ' + $package) }
}

function Get-VsWherePath {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace(${env:ProgramFiles(x86)})) {
    $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe')
  }
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
    $candidates += (Join-Path $env:ProgramFiles 'Microsoft Visual Studio\Installer\vswhere.exe')
  }

  foreach ($candidate in (Convert-ToSafeArray ($candidates | Where-Object { $_ }))) {
    $resolved = Resolve-PathIfExists ([string]$candidate)
    if ($resolved) { return $resolved }
  }

  return $null
}

function Get-VsInstallRoots($Config = $null) {
  $roots = New-StringList

  foreach ($manualRoot in @(
    (Get-FirstConfigValue $Config @('VSINSTALLDIR', 'VS_INSTALL_PATH', 'VS_PATH', 'VS_BUILDTOOLS_PATH', 'VISUAL_STUDIO_PATH')),
    $env:VSINSTALLDIR,
    $env:VisualStudioDir
  )) {
    Add-UniqueExistingPath $roots ([string]$manualRoot)
  }

  foreach ($candidate in @(
    'C:\Program Files\Microsoft Visual Studio\2022\BuildTools',
    'C:\Program Files\Microsoft Visual Studio\2022\Community',
    'C:\Program Files\Microsoft Visual Studio\2022\Professional',
    'C:\Program Files\Microsoft Visual Studio\2022\Enterprise',
    'C:\Program Files\Microsoft Visual Studio\18\BuildTools',
    'C:\Program Files\Microsoft Visual Studio\18\Community',
    'C:\Program Files\Microsoft Visual Studio\18\Professional',
    'C:\Program Files\Microsoft Visual Studio\18\Enterprise',
    'C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools',
    'C:\Program Files (x86)\Microsoft Visual Studio\2019\Community',
    'C:\Program Files (x86)\Microsoft Visual Studio\2019\Professional',
    'C:\Program Files (x86)\Microsoft Visual Studio\2019\Enterprise'
  )) {
    Add-UniqueExistingPath $roots $candidate
  }

  $vswhere = Get-VsWherePath
  if ($vswhere) {
    foreach ($args in @(
      @('-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'),
      @('-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath')
    )) {
      try {
        $output = & $vswhere @args 2>$null
        if ($LASTEXITCODE -eq 0) {
          foreach ($line in (Convert-ToSafeArray $output)) {
            Add-UniqueExistingPath $roots ([string]$line)
          }
        }
      }
      catch {}
    }
  }

  foreach ($base in @('C:\Program Files\Microsoft Visual Studio', 'C:\Program Files (x86)\Microsoft Visual Studio')) {
    if (-not (Test-Path $base)) { continue }
    foreach ($yearDir in Get-ChildItem $base -Directory -ErrorAction SilentlyContinue) {
      foreach ($editionDir in Get-ChildItem $yearDir.FullName -Directory -ErrorAction SilentlyContinue) {
        if (Test-Path (Join-Path $editionDir.FullName 'VC\Auxiliary\Build')) {
          Add-UniqueExistingPath $roots $editionDir.FullName
        }
      }
    }
  }

  if ($env:VSINSTALLDIR) {
    Add-UniqueExistingPath $roots $env:VSINSTALLDIR
  }

  return @(Convert-ToSafeArray $roots)
}

function Find-MsvcEnvScript([string]$InstallPath) {
  foreach ($candidate in @(
    (Join-Path $InstallPath 'VC\Auxiliary\Build\vcvars64.bat'),
    (Join-Path $InstallPath 'Common7\Tools\VsDevCmd.bat'),
    (Join-Path $InstallPath 'VC\Auxiliary\Build\vcvarsall.bat')
  )) {
    if (Test-Path $candidate) {
      try { return (Resolve-Path $candidate).Path } catch { return $candidate }
    }
  }
  return $null
}

function Get-MsvcEnvArguments([string]$EnvScriptPath) {
  if ([string]::IsNullOrWhiteSpace($EnvScriptPath)) { return @() }
  $scriptBaseName = [System.IO.Path]::GetFileName([string]$EnvScriptPath)
  if ([string]::IsNullOrWhiteSpace($scriptBaseName)) { return @() }
  $scriptName = $scriptBaseName.ToLowerInvariant()
  if ($scriptName -eq 'vsdevcmd.bat') { return @('-arch=x64', '-host_arch=x64') }
  if ($scriptName -eq 'vcvarsall.bat') { return @('x64') }
  return @()
}

function Import-BatchEnvironment([string]$BatchPath, [string[]]$Arguments) {
  if ([string]::IsNullOrWhiteSpace($BatchPath) -or -not (Test-Path $BatchPath)) { return $false }
  $argString = ''
  if ($Arguments) { $argString = (@($Arguments | Where-Object { $_ }) -join ' ') }
  $callCommand = ('call "{0}"' -f [string]$BatchPath)
  if (-not [string]::IsNullOrWhiteSpace($argString)) {
    $callCommand += (' ' + $argString)
  }
  $commandText = ($callCommand + ' >nul && set').Trim()
  try {
    $output = & cmd.exe /d /c $commandText 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    foreach ($line in (Convert-ToSafeArray $output)) {
      if ($line -match '^([^=]+)=(.*)$') {
        $name = [string]$matches[1]
        $value = [string]$matches[2]
        if (-not [string]::IsNullOrWhiteSpace($name)) {
          Set-Item -Path ('Env:{0}' -f $name) -Value $value
        }
      }
    }
    return $true
  }
  catch {
    return $false
  }
}

function Get-VcToolsRootFromLinkPath([string]$LinkPath) {
  if ([string]::IsNullOrWhiteSpace($LinkPath)) { return $null }
  try {
    $binRoot = Split-Path (Split-Path (Split-Path $LinkPath -Parent) -Parent) -Parent
    if (Test-Path (Join-Path $binRoot 'lib\x64')) {
      try { return (Resolve-Path $binRoot).Path } catch { return $binRoot }
    }
  }
  catch {}
  return $null
}

function Get-MsvcState($Config = $null) {
  $result = [pscustomobject]@{
    Ready = $false
    InstallPath = ''
    EnvScript = ''
    EnvArguments = @()
    LinkPath = ''
    VcToolsRoot = ''
    VcLibPaths = @()
    VcIncludePaths = @()
    Imported = $false
    Comment = ''
  }

  $manualEnvScript = Get-FirstConfigValue $Config @('VSDEVCMD_BAT', 'VSDEV_CMD_BAT', 'VCVARS_BAT', 'VCVARS64_BAT', 'MSVC_ENV_BAT')
  $manualLinkPath = Get-FirstConfigValue $Config @('LINK_EXE', 'MSVC_LINK_EXE')

  $roots = @()
  $manualInstallRoot = Get-FirstConfigValue $Config @('VSINSTALLDIR', 'VS_INSTALL_PATH', 'VS_PATH', 'VS_BUILDTOOLS_PATH', 'VISUAL_STUDIO_PATH')
  if ($manualInstallRoot) { $roots += $manualInstallRoot }
  if ($env:VSINSTALLDIR) { $roots += $env:VSINSTALLDIR }
  $roots += @(Get-VsInstallRoots $Config)
  $roots = @($roots | Where-Object { $_ } | Select-Object -Unique)

  if ($manualEnvScript) {
    $resolvedManualEnvScript = Resolve-PathIfExists $manualEnvScript
    if ($resolvedManualEnvScript) {
      $result.EnvScript = $resolvedManualEnvScript
      $result.EnvArguments = @(Get-MsvcEnvArguments $resolvedManualEnvScript)
    }
  }

  $currentLink = Get-CommandPathSafe 'link.exe'
  if ($manualLinkPath) {
    $resolvedManualLinkPath = Resolve-PathIfExists $manualLinkPath
    if ($resolvedManualLinkPath) {
      $currentLink = $resolvedManualLinkPath
    }
  }
  if ($currentLink) {
    $result.LinkPath = $currentLink
    $result.VcToolsRoot = Get-VcToolsRootFromLinkPath $currentLink
  }
  if ($env:VCToolsInstallDir -and (Test-Path $env:VCToolsInstallDir)) {
    try { $result.VcToolsRoot = (Resolve-Path $env:VCToolsInstallDir).Path } catch { $result.VcToolsRoot = $env:VCToolsInstallDir }
  }

  if ($result.EnvScript -and (-not $result.Imported) -and (-not $result.LinkPath -or [string]::IsNullOrWhiteSpace($env:WindowsSdkDir) -or [string]::IsNullOrWhiteSpace($env:VCToolsInstallDir))) {
    $importedManual = Import-BatchEnvironment $result.EnvScript $result.EnvArguments
    if ($importedManual) {
      $result.Imported = $true
      $currentLink = Get-CommandPathSafe 'link.exe'
      if ($currentLink) { $result.LinkPath = $currentLink }
      if ($env:VCToolsInstallDir -and (Test-Path $env:VCToolsInstallDir)) {
        try { $result.VcToolsRoot = (Resolve-Path $env:VCToolsInstallDir).Path } catch { $result.VcToolsRoot = $env:VCToolsInstallDir }
      }
    }
  }

  foreach ($installPath in $roots) {
    if ([string]::IsNullOrWhiteSpace($result.InstallPath)) { $result.InstallPath = [string]$installPath }
    $envScript = Find-MsvcEnvScript $installPath
    if ([string]::IsNullOrWhiteSpace($result.EnvScript) -and $envScript) {
      $result.EnvScript = $envScript
      $result.EnvArguments = @(Get-MsvcEnvArguments $envScript)
    }

    if ($envScript -and (-not $result.Imported) -and (-not $result.LinkPath -or [string]::IsNullOrWhiteSpace($env:WindowsSdkDir) -or [string]::IsNullOrWhiteSpace($env:VCToolsInstallDir))) {
      $imported = Import-BatchEnvironment $envScript $result.EnvArguments
      if ($imported) {
        $result.Imported = $true
        $currentLink = Get-CommandPathSafe 'link.exe'
        if ($currentLink) { $result.LinkPath = $currentLink }
        if ($env:VCToolsInstallDir -and (Test-Path $env:VCToolsInstallDir)) {
          try { $result.VcToolsRoot = (Resolve-Path $env:VCToolsInstallDir).Path } catch { $result.VcToolsRoot = $env:VCToolsInstallDir }
        }
      }
    }

    if (-not $result.VcToolsRoot) {
      $msvcRoot = Join-Path $installPath 'VC\Tools\MSVC'
      if (Test-Path $msvcRoot) {
        $toolDir = Get-ChildItem $msvcRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if ($toolDir) { $result.VcToolsRoot = $toolDir.FullName }
      }
    }

    if ($result.LinkPath -or $result.VcToolsRoot) { break }
  }

  $vcLibPaths = @()
  $vcIncludePaths = @()
  if ($result.VcToolsRoot) {
    foreach ($path in @(
      (Join-Path $result.VcToolsRoot 'lib\x64'),
      (Join-Path $result.VcToolsRoot 'atlmfc\lib\x64')
    )) {
      if (Test-Path $path) { $vcLibPaths += $path }
    }
    foreach ($path in @(
      (Join-Path $result.VcToolsRoot 'include'),
      (Join-Path $result.VcToolsRoot 'atlmfc\include')
    )) {
      if (Test-Path $path) { $vcIncludePaths += $path }
    }
  }

  $result.VcLibPaths = @($vcLibPaths | Where-Object { $_ } | Select-Object -Unique)
  $result.VcIncludePaths = @($vcIncludePaths | Where-Object { $_ } | Select-Object -Unique)

  if ($result.LinkPath -and @($result.VcLibPaths).Count -gt 0) {
    $result.Ready = $true
    if ($result.Imported) {
      $result.Comment = 'MSVC host toolchain found and env imported'
    }
    else {
      $result.Comment = 'MSVC host toolchain found'
    }
  }
  elseif (@($roots).Count -eq 0) {
    $result.Comment = 'Visual Studio / Build Tools with C++ workload were not found'
  }
  else {
    $result.Comment = 'Visual Studio was found, but the full MSVC host route could not be prepared (env script / link.exe / VC libs)'
  }

  return $result
}

function Get-WindowsSdkRoots {
  $roots = New-StringList
  foreach ($regPath in @(
    'HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows Kits\Installed Roots'
  )) {
    try {
      $item = Get-ItemProperty -Path $regPath -ErrorAction Stop
      foreach ($propName in @('KitsRoot10', 'KitsRoot11')) {
        if ($item.PSObject.Properties.Name -contains $propName) {
          Add-UniqueExistingPath $roots ([string]$item.$propName)
        }
      }
    }
    catch {}
  }

  $fallbackCandidates = @()
  if (-not [string]::IsNullOrWhiteSpace(${env:ProgramFiles(x86)})) {
    $fallbackCandidates += (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10')
    $fallbackCandidates += (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\11')
  }
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
    $fallbackCandidates += (Join-Path $env:ProgramFiles 'Windows Kits\10')
    $fallbackCandidates += (Join-Path $env:ProgramFiles 'Windows Kits\11')
  }
  if (-not [string]::IsNullOrWhiteSpace($env:WindowsSdkDir)) { $fallbackCandidates += $env:WindowsSdkDir }
  if (-not [string]::IsNullOrWhiteSpace($env:UniversalCRTSdkDir)) { $fallbackCandidates += $env:UniversalCRTSdkDir }

  foreach ($candidate in $fallbackCandidates) {
    Add-UniqueExistingPath $roots $candidate
  }

  return @(Convert-ToSafeArray $roots)
}

function New-WindowsSdkState {
  return [pscustomobject]@{
    Ready = $false
    Root = ''
    Version = ''
    LibPaths = @()
    IncludePaths = @()
    BinPath = ''
    Kernel32Path = ''
    Comment = ''
  }
}

function Test-WindowsSdkCandidate([string]$RootPath, [string]$VersionText) {
  $state = New-WindowsSdkState
  if ([string]::IsNullOrWhiteSpace($RootPath)) { return $state }
  $version = ([string]$VersionText).Trim().TrimEnd([char]'\')
  if ([string]::IsNullOrWhiteSpace($version)) { return $state }

  $umLib = Join-Path $RootPath ('Lib\\' + $version + '\\um\\x64')
  $ucrtLib = Join-Path $RootPath ('Lib\\' + $version + '\\ucrt\\x64')
  $kernel32 = Join-Path $umLib 'kernel32.lib'
  $ucrt = Join-Path $ucrtLib 'ucrt.lib'
  if (-not (Test-Path $kernel32)) { return $state }
  if (-not (Test-Path $ucrt)) { return $state }

  $includeRoot = Join-Path $RootPath ('Include\\' + $version)
  $includePaths = @()
  foreach ($folder in @('ucrt', 'shared', 'um', 'winrt', 'cppwinrt')) {
    $candidate = Join-Path $includeRoot $folder
    if (Test-Path $candidate) { $includePaths += $candidate }
  }

  $binPath = ''
  foreach ($candidate in @(
    (Join-Path $RootPath ('bin\\' + $version + '\\x64')),
    (Join-Path $RootPath 'bin\\x64')
  )) {
    if (Test-Path $candidate) {
      try { $binPath = (Resolve-Path $candidate).Path } catch { $binPath = $candidate }
      break
    }
  }

  $state.Ready = $true
  try { $state.Root = (Resolve-Path $RootPath).Path } catch { $state.Root = $RootPath }
  $state.Version = $version
  $state.LibPaths = @($umLib, $ucrtLib)
  $state.IncludePaths = @($includePaths | Where-Object { $_ } | Select-Object -Unique)
  $state.BinPath = $binPath
  $state.Kernel32Path = $kernel32
  $state.Comment = 'Windows SDK found'
  return $state
}

function Get-WindowsSdkState($Config = $null) {
  $manualRoot = Get-FirstConfigValue $Config @('WINDOWS_SDK_DIR', 'WINDOWSSDKDIR', 'WINDOWS_SDK_ROOT', 'WINSDK_DIR')
  $manualVersion = Get-FirstConfigValue $Config @('WINDOWS_SDK_VERSION', 'WINSDK_VERSION', 'UCRTVersion')
  if (-not [string]::IsNullOrWhiteSpace($manualRoot)) {
    if (-not [string]::IsNullOrWhiteSpace($manualVersion)) {
      $manualState = Test-WindowsSdkCandidate $manualRoot $manualVersion
      if ($manualState.Ready) { return $manualState }
    }
    $manualLibRoot = Join-Path $manualRoot 'Lib'
    if (Test-Path $manualLibRoot) {
      $dirs = Get-ChildItem $manualLibRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
      foreach ($dir in $dirs) {
        $manualState = Test-WindowsSdkCandidate $manualRoot $dir.Name
        if ($manualState.Ready) { return $manualState }
      }
    }
  }

  $envVersionCandidates = @(
    $env:WindowsSdkVersion,
    $env:UCRTVersion
  ) | Where-Object { $_ }

  foreach ($root in (Get-WindowsSdkRoots)) {
    foreach ($version in $envVersionCandidates) {
      $envState = Test-WindowsSdkCandidate $root $version
      if ($envState.Ready) { return $envState }
    }
  }

  foreach ($root in (Get-WindowsSdkRoots)) {
    $libRoot = Join-Path $root 'Lib'
    if (-not (Test-Path $libRoot)) { continue }
    $dirs = Get-ChildItem $libRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    foreach ($dir in $dirs) {
      $state = Test-WindowsSdkCandidate $root $dir.Name
      if ($state.Ready) { return $state }
    }
  }

  $empty = New-WindowsSdkState
  $empty.Comment = 'Windows SDK lib path was not detected automatically'
  return $empty
}

function Build-SemicolonPath([object[]]$Values) {
  $list = New-StringList
  foreach ($value in (Convert-ToSafeArray $Values)) {
    $text = [string]$value
    if ([string]::IsNullOrWhiteSpace($text)) { continue }
    Add-UniqueExistingPath $list $text
  }
  return ((Convert-ToSafeArray $list) -join ';')
}

function Get-MissingRustTargets {
  $requiredTargets = @(
    'aarch64-linux-android',
    'armv7-linux-androideabi',
    'i686-linux-android',
    'x86_64-linux-android'
  )

  if (-not (Has-Command 'rustup')) { return $requiredTargets }

  $installed = Convert-ToSafeArray (& rustup target list --installed)
  if ($LASTEXITCODE -ne 0) { return $requiredTargets }

  $missing = @()
  foreach ($target in $requiredTargets) {
    if ($installed -notcontains $target) { $missing += $target }
  }
  return @($missing)
}

function Get-InstalledNodePackageVersion([string]$RootPath, [string]$PackageName) {
  $packageJsonPath = Join-Path $RootPath ('node_modules\' + ($PackageName -replace '/', '\\') + '\\package.json')
  if (-not (Test-Path $packageJsonPath)) { return $null }
  try {
    $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    if ($packageJson -and $packageJson.version) { return [string]$packageJson.version }
  }
  catch { return $null }
  return $null
}

function Get-RequestedTauriNpmVersions($PackageObject) {
  $requested = @{}
  if ($PackageObject.dependencies -and $PackageObject.dependencies.'@tauri-apps/api') {
    $requested['@tauri-apps/api'] = [string]$PackageObject.dependencies.'@tauri-apps/api'
  }
  if ($PackageObject.devDependencies -and $PackageObject.devDependencies.'@tauri-apps/cli') {
    $requested['@tauri-apps/cli'] = [string]$PackageObject.devDependencies.'@tauri-apps/cli'
  }
  return $requested
}

function Test-TauriNodeModulesMatch([string]$RootPath, $PackageObject) {
  $requested = Get-RequestedTauriNpmVersions $PackageObject
  foreach ($packageName in $requested.Keys) {
    $expectedVersion = [string]$requested[$packageName]
    $installedVersion = Get-InstalledNodePackageVersion $RootPath $packageName
    if ([string]::IsNullOrWhiteSpace($installedVersion)) { return $false }
    if ($installedVersion -ne $expectedVersion) { return $false }
  }
  return $true
}

function Get-RequestedNodePackageNames($PackageObject) {
  $names = New-StringList
  foreach ($collectionName in @('dependencies', 'devDependencies')) {
    if ($PackageObject.PSObject.Properties.Name -notcontains $collectionName) { continue }
    $collection = $PackageObject.$collectionName
    if ($null -eq $collection) { continue }
    foreach ($prop in $collection.PSObject.Properties) {
      Add-UniqueString $names ([string]$prop.Name)
    }
  }
  return @(Convert-ToSafeArray $names)
}

function Get-MissingNodePackages([string]$RootPath, $PackageObject) {
  $missing = @()
  foreach ($packageName in (Get-RequestedNodePackageNames $PackageObject)) {
    $packageJsonPath = Join-Path $RootPath ('node_modules\' + ($packageName -replace '/', '\\') + '\\package.json')
    if (-not (Test-Path $packageJsonPath)) {
      $missing += $packageName
    }
  }
  return @($missing)
}

function Test-NodeModulesReady([string]$RootPath, $PackageObject) {
  if (-not (Test-Path (Join-Path $RootPath 'node_modules'))) { return $false }
  if (-not (Test-TauriNodeModulesMatch $RootPath $PackageObject)) { return $false }
  return (@(Get-MissingNodePackages $RootPath $PackageObject).Count -eq 0)
}

function Invoke-CmdWithToolchain([string]$WorkingDirectory, [string]$CommandText, $MsvcState, $WindowsSdkState, $ExtraEnv) {
  $tempScript = Join-Path ([System.IO.Path]::GetTempPath()) ('lovers_calendar_cmd_' + [System.Guid]::NewGuid().ToString('N') + '.cmd')
  $lines = @('@echo off', 'setlocal')

  if ($MsvcState -and -not [string]::IsNullOrWhiteSpace([string]$MsvcState.EnvScript)) {
    $argsText = Join-SafeItems $MsvcState.EnvArguments ' '
    $callLine = ('call "{0}"' -f [string]$MsvcState.EnvScript).Trim()
    if (-not [string]::IsNullOrWhiteSpace($argsText)) { $callLine += ' ' + $argsText }
    $lines += ($callLine + ' >nul')
    $lines += 'if errorlevel 1 exit /b %errorlevel%'
  }

  if ($ExtraEnv) {
    foreach ($key in $ExtraEnv.Keys) {
      $value = [string]$ExtraEnv[$key]
      if ([string]::IsNullOrWhiteSpace($value)) { continue }
      $lines += ('set "{0}={1}"' -f $key, $value)
    }
  }

  $pathItems = @()
  if ($MsvcState -and -not [string]::IsNullOrWhiteSpace([string]$MsvcState.VcToolsRoot)) {
    $pathItems += (Join-Path $MsvcState.VcToolsRoot 'bin\HostX64\x64')
  }
  if ($WindowsSdkState -and -not [string]::IsNullOrWhiteSpace([string]$WindowsSdkState.BinPath)) {
    $pathItems += $WindowsSdkState.BinPath
  }
  $extraPath = Build-SemicolonPath $pathItems
  if (-not [string]::IsNullOrWhiteSpace($extraPath)) { $lines += ('set "PATH={0};%PATH%"' -f $extraPath) }

  $msvcLibPaths = @()
  if ($MsvcState -and $MsvcState.PSObject.Properties.Name -contains 'VcLibPaths') {
    $msvcLibPaths = @($MsvcState.VcLibPaths)
  }
  $windowsLibPaths = @()
  if ($WindowsSdkState -and $WindowsSdkState.PSObject.Properties.Name -contains 'LibPaths') {
    $windowsLibPaths = @($WindowsSdkState.LibPaths)
  }
  $extraLib = Build-SemicolonPath ($msvcLibPaths + $windowsLibPaths)
  if (-not [string]::IsNullOrWhiteSpace($extraLib)) { $lines += ('set "LIB={0};%LIB%"' -f $extraLib) }

  $msvcIncludePaths = @()
  if ($MsvcState -and $MsvcState.PSObject.Properties.Name -contains 'VcIncludePaths') {
    $msvcIncludePaths = @($MsvcState.VcIncludePaths)
  }
  $windowsIncludePaths = @()
  if ($WindowsSdkState -and $WindowsSdkState.PSObject.Properties.Name -contains 'IncludePaths') {
    $windowsIncludePaths = @($WindowsSdkState.IncludePaths)
  }
  $extraInclude = Build-SemicolonPath ($msvcIncludePaths + $windowsIncludePaths)
  if (-not [string]::IsNullOrWhiteSpace($extraInclude)) { $lines += ('set "INCLUDE={0};%INCLUDE%"' -f $extraInclude) }

  if ($WindowsSdkState -and $WindowsSdkState.Ready) {
    $lines += ('set "WindowsSdkDir={0}"' -f [string]$WindowsSdkState.Root)
    $lines += ('set "UniversalCRTSdkDir={0}"' -f [string]$WindowsSdkState.Root)
    $lines += ('set "WindowsSdkVersion={0}"' -f [string]$WindowsSdkState.Version)
    $lines += ('set "UCRTVersion={0}"' -f [string]$WindowsSdkState.Version)
  }

  $lines += ('cd /d "{0}"' -f $WorkingDirectory)
  $lines += $CommandText
  $lines += 'exit /b %errorlevel%'

  $lines | Set-Content -Path $tempScript -Encoding ASCII
  try {
    $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', '"' + $tempScript + '"') -Wait -NoNewWindow -PassThru
    return [int]$process.ExitCode
  }
  finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tempScript
  }
}

function Get-LatestLogText([string[]]$CandidatePaths) {
  foreach ($candidate in (Convert-ToSafeArray $CandidatePaths)) {
    if ([string]::IsNullOrWhiteSpace([string]$candidate)) { continue }
    if (-not (Test-Path $candidate)) { continue }
    try { return (Get-Content $candidate -Raw -ErrorAction Stop) } catch {}
  }
  return ''
}

function Get-AndroidBuildFailureHint([string]$RootPath) {
  $text = Get-LatestLogText @(
    (Join-Path $RootPath 'logs\android-build_LATEST.log'),
    (Join-Path $RootPath 'logs\apk_build_LATEST.log'),
    (Join-Path $RootPath 'logs\build_LATEST.log'),
    (Join-Path $RootPath 'logs\android_build_LATEST.log')
  )

  if ([string]::IsNullOrWhiteSpace($text)) {
    return 'tauri android build failed.'
  }

  if ($text -match 'kernel32\.lib' -or $text -match 'LNK1181') {
    return 'During host build Cargo could not open kernel32.lib. This usually means Windows SDK is missing in Visual Studio / Build Tools or its paths were not prepared. Open Visual Studio Installer and enable Desktop development with C++ plus Windows SDK.'
  }
  if ($text -match 'linker `?link\.exe`? not found' -or $text -match '\blink\.exe\b.*not found' -or $text -match '\blink\.exe\b.*not recognized' -or $text -match 'Visual Studio / Build Tools' -or $text -match 'could not execute process .*link\.exe') {
    return 'Cargo failed because the Windows host linker was not available. Install Visual Studio Build Tools with Desktop development with C++ and Windows SDK, or use a Windows GNU Rust host toolchain if that is your chosen route.'
  }
  if ($text -match 'mismatched versions' -or $text -match 'Failed to parse version' -or $text -match 'tauri-build\s*=\s*"\^') {
    return 'Build failed because Tauri versions are out of sync. Check package.json and src-tauri/Cargo.toml.'
  }
  if ($text -match 'sdkmanager' -and $text -match 'not found') {
    return 'tauri android build did not detect Android Command-line Tools. Check Android SDK Command-line Tools and ANDROID_SDK_ROOT.'
  }
  if ($text -match 'Missing script:\s*"tauri"' -or $text -match "Missing script:\s*'tauri'") {
    return 'Android Gradle called npm run tauri, but package.json does not contain the base script. Add "tauri": "npx tauri" to scripts or use patch 0.5.6+.'
  }
  if ($text -match 'CorruptedCacheException' -or $text -match 'file-access\.bin' -or $text -match 'journal-1') {
    return 'Gradle cache is corrupted. Clear the broken cache or use the new project-local GRADLE_USER_HOME route from patch 0.5.8.'
  }
  return 'tauri android build failed. Open logs\apk_build_LATEST.log and logs\android-build_LATEST.log.'
}
