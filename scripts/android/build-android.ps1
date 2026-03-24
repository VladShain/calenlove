$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

. (Join-Path $PSScriptRoot '_android-common.ps1')

function Write-Section([string]$Text) {
  Write-Host ''
  Write-Host '=================================================='
  Write-Host $Text
  Write-Host '=================================================='
}

$script:Lines = New-Object 'System.Collections.Generic.List[string]'
$script:LiveLogTargets = @()

function Log([string]$Text = '') {
  Write-Host $Text
  $lineText = [string]$Text
  $script:Lines.Add($lineText) | Out-Null
  foreach ($target in (Convert-ToSafeArray $script:LiveLogTargets)) {
    if ([string]::IsNullOrWhiteSpace([string]$target)) { continue }
    try { Add-Content -Path $target -Value $lineText -Encoding UTF8 } catch {}
  }
}

function Step([string]$Text) {
  Log ('[STEP] ' + $Text)
}

function Fail([string]$Message) {
  throw $Message
}


function Get-KeytoolPath([string]$JavaHome) {
  if ([string]::IsNullOrWhiteSpace($JavaHome)) { return $null }
  foreach ($name in @('keytool.exe', 'keytool')) {
    $candidate = Join-Path $JavaHome ('bin\' + $name)
    if (Test-Path $candidate) {
      try { return (Resolve-Path $candidate).Path } catch { return $candidate }
    }
  }
  return $null
}

function Convert-VersionSortKey([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return '0000000000' }
  $parts = @($Text -split '[^0-9]+' | Where-Object { $_ -ne '' } | ForEach-Object { '{0:D10}' -f [int]$_ })
  if (@($parts).Count -eq 0) { return '0000000000' }
  return ($parts -join '.')
}

function Get-AndroidBuildToolsDirs([string]$SdkRoot) {
  if ([string]::IsNullOrWhiteSpace($SdkRoot)) { return @() }
  $root = Join-Path $SdkRoot 'build-tools'
  if (-not (Test-Path $root)) { return @() }
  return @(Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | Sort-Object @{ Expression = { Convert-VersionSortKey $_.Name }; Descending = $true })
}

function Find-AndroidBuildToolPath([string]$SdkRoot, [string]$ToolName) {
  foreach ($dir in (Get-AndroidBuildToolsDirs $SdkRoot)) {
    foreach ($candidateName in @(($ToolName + '.bat'), ($ToolName + '.exe'), $ToolName)) {
      $candidate = Join-Path $dir.FullName $candidateName
      if (Test-Path $candidate) {
        try { return (Resolve-Path $candidate).Path } catch { return $candidate }
      }
    }
  }
  return $null
}

function Get-ApkSigningConfig([string]$RootPath, $Config, [string]$JavaHome) {
  $requestedMode = (Get-KeyApiValue $Config 'APK_SIGN_MODE')
  if ([string]::IsNullOrWhiteSpace($requestedMode)) { $requestedMode = 'debug' }
  $requestedMode = $requestedMode.Trim().ToLowerInvariant()
  $keystorePath = (Get-KeyApiValue $Config 'APK_KEYSTORE_PATH')
  $alias = (Get-KeyApiValue $Config 'APK_KEY_ALIAS')
  $storePassword = (Get-KeyApiValue $Config 'APK_STORE_PASSWORD')
  $keyPassword = (Get-KeyApiValue $Config 'APK_KEY_PASSWORD')
  $dname = (Get-KeyApiValue $Config 'APK_KEY_DNAME')
  if ([string]::IsNullOrWhiteSpace($dname)) { $dname = 'CN=Android Debug,O=Android,C=US' }

  if ($requestedMode -eq 'unsigned') {
    return [pscustomobject]@{
      Enabled = $false
      Mode = 'unsigned'
      DisplayMode = 'unsigned'
      KeystorePath = ''
      Alias = ''
      StorePassword = ''
      KeyPassword = ''
      DName = $dname
      KeytoolPath = (Get-KeytoolPath $JavaHome)
    }
  }

  $hasCustomKeystore = -not [string]::IsNullOrWhiteSpace($keystorePath)
  if ($hasCustomKeystore) {
    if ([string]::IsNullOrWhiteSpace($alias)) { Fail 'APK_KEY_ALIAS is empty in KEY_API.' }
    if ([string]::IsNullOrWhiteSpace($storePassword)) { Fail 'APK_STORE_PASSWORD is empty in KEY_API.' }
    if ([string]::IsNullOrWhiteSpace($keyPassword)) { $keyPassword = $storePassword }
    return [pscustomobject]@{
      Enabled = $true
      Mode = 'custom'
      DisplayMode = 'custom keystore'
      KeystorePath = $keystorePath
      Alias = $alias
      StorePassword = $storePassword
      KeyPassword = $keyPassword
      DName = $dname
      KeytoolPath = (Get-KeytoolPath $JavaHome)
    }
  }

  if ([string]::IsNullOrWhiteSpace($alias)) { $alias = 'androiddebugkey' }
  if ([string]::IsNullOrWhiteSpace($storePassword)) { $storePassword = 'android' }
  if ([string]::IsNullOrWhiteSpace($keyPassword)) { $keyPassword = 'android' }
  $defaultKeystore = Join-Path $RootPath 'ANDROID\debug.keystore'
  return [pscustomobject]@{
    Enabled = $true
    Mode = 'debug'
    DisplayMode = 'debug keystore'
    KeystorePath = $defaultKeystore
    Alias = $alias
    StorePassword = $storePassword
    KeyPassword = $keyPassword
    DName = $dname
    KeytoolPath = (Get-KeytoolPath $JavaHome)
  }
}

function Ensure-ApkSigningKeystore([object]$SigningConfig) {
  if (-not $SigningConfig.Enabled) { return }
  if (Test-Path $SigningConfig.KeystorePath) { return }
  if ($SigningConfig.Mode -eq 'custom') {
    Fail ('APK keystore was not found: ' + $SigningConfig.KeystorePath)
  }
  if ([string]::IsNullOrWhiteSpace($SigningConfig.KeytoolPath) -or -not (Test-Path $SigningConfig.KeytoolPath)) {
    Fail 'keytool was not found in JAVA_HOME. It is required to generate the debug keystore.'
  }
  $parent = Split-Path $SigningConfig.KeystorePath -Parent
  if (-not [string]::IsNullOrWhiteSpace($parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  & $SigningConfig.KeytoolPath -genkeypair -v -keystore $SigningConfig.KeystorePath -storepass $SigningConfig.StorePassword -alias $SigningConfig.Alias -keypass $SigningConfig.KeyPassword -keyalg RSA -keysize 2048 -validity 10000 -dname $SigningConfig.DName
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $SigningConfig.KeystorePath)) {
    Fail 'Failed to generate the debug keystore for APK signing.'
  }
}

function Sign-AndroidApk([string]$ApkPath, [string]$SdkRoot, [object]$SigningConfig) {
  if (-not $SigningConfig.Enabled) {
    return [pscustomobject]@{ Path = $ApkPath; Signed = $false }
  }

  $apksigner = Find-AndroidBuildToolPath $SdkRoot 'apksigner'
  if ([string]::IsNullOrWhiteSpace($apksigner)) {
    Fail 'apksigner was not found in Android SDK build-tools.'
  }

  $zipalign = Find-AndroidBuildToolPath $SdkRoot 'zipalign'
  $baseDir = Split-Path $ApkPath -Parent
  $leaf = Split-Path $ApkPath -Leaf
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($leaf)
  if ($stem.EndsWith('-unsigned', [System.StringComparison]::OrdinalIgnoreCase)) {
    $stem = $stem.Substring(0, $stem.Length - 9)
  }
  $alignedApk = Join-Path $baseDir ($stem + '-aligned.apk')
  $signedApk = Join-Path $baseDir ($stem + '-signed.apk')
  Remove-Item -Force -ErrorAction SilentlyContinue $alignedApk, $signedApk

  if (-not [string]::IsNullOrWhiteSpace($zipalign)) {
    & $zipalign -f -p 4 $ApkPath $alignedApk
    if ($LASTEXITCODE -ne 0) { Fail 'zipalign failed for the built APK.' }
  }
  else {
    Copy-Item -Force $ApkPath $alignedApk
  }

  & $apksigner sign --ks $SigningConfig.KeystorePath --ks-key-alias $SigningConfig.Alias --ks-pass ('pass:' + $SigningConfig.StorePassword) --key-pass ('pass:' + $SigningConfig.KeyPassword) --out $signedApk $alignedApk
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $signedApk)) {
    Fail 'apksigner sign failed for the built APK.'
  }

  & $apksigner verify --print-certs $signedApk | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Fail 'apksigner verify failed for the signed APK.'
  }

  Remove-Item -Force -ErrorAction SilentlyContinue $alignedApk
  return [pscustomobject]@{ Path = $signedApk; Signed = $true }
}


function Get-ApkEmbeddedCertificateState([string]$ApkPath) {
  $result = [pscustomobject]@{ Signed = $false; SignatureFiles = @() }
  if ([string]::IsNullOrWhiteSpace($ApkPath) -or -not (Test-Path $ApkPath)) { return $result }
  try { Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue } catch {}
  $zip = $null
  try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ApkPath)
    $sigFiles = New-Object 'System.Collections.Generic.List[string]'
    $hasManifestSignature = $false
    $hasSignatureBlock = $false
    foreach ($entry in $zip.Entries) {
      $name = ([string]$entry.FullName).ToUpperInvariant()
      if ($name -like 'META-INF/*.SF') { $hasManifestSignature = $true; $sigFiles.Add($entry.FullName) | Out-Null }
      elseif ($name -like 'META-INF/*.RSA' -or $name -like 'META-INF/*.DSA' -or $name -like 'META-INF/*.EC') { $hasSignatureBlock = $true; $sigFiles.Add($entry.FullName) | Out-Null }
    }
    $result = [pscustomobject]@{ Signed = ($hasManifestSignature -and $hasSignatureBlock); SignatureFiles = @($sigFiles) }
  }
  catch {
    $result = [pscustomobject]@{ Signed = $false; SignatureFiles = @() }
  }
  finally { if ($zip) { $zip.Dispose() } }
  return $result
}

function Test-ApkHasCertificates([string]$ApkPath, [string]$SdkRoot) {
  if ([string]::IsNullOrWhiteSpace($ApkPath) -or -not (Test-Path $ApkPath)) { return $false }
  $embedded = Get-ApkEmbeddedCertificateState $ApkPath
  if ($embedded.Signed) { return $true }
  $leafName = [System.IO.Path]::GetFileName($ApkPath)
  if ($leafName -like '*-unsigned.apk') { return $false }
  $apksigner = Find-AndroidBuildToolPath $SdkRoot 'apksigner'
  if (-not [string]::IsNullOrWhiteSpace($apksigner) -and (Test-Path $apksigner)) {
    & $apksigner verify --print-certs $ApkPath | Out-Null
    return ($LASTEXITCODE -eq 0)
  }
  return $false
}

function Get-ApkBuildProfile($Config) {
  $profile = (Get-KeyApiValue $Config 'APK_BUILD_PROFILE')
  if ([string]::IsNullOrWhiteSpace($profile)) { $profile = 'debug' }
  $profile = $profile.Trim().ToLowerInvariant()
  if (@('debug', 'release') -notcontains $profile) {
    Fail 'APK_BUILD_PROFILE must be debug or release.'
  }
  return $profile
}

function Get-ApkBuildTargets($Config) {
  $raw = (Get-KeyApiValue $Config 'APK_TARGETS')
  if ([string]::IsNullOrWhiteSpace($raw)) { $raw = 'aarch64' }
  $allowed = @('aarch64', 'armv7', 'i686', 'x86_64')
  $targets = New-Object 'System.Collections.Generic.List[string]'
  foreach ($part in ($raw -split '[,; ]+')) {
    $item = ([string]$part).Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($item)) { continue }
    if ($allowed -notcontains $item) {
      Fail ('Unsupported APK target in KEY_API: ' + $item + '. Allowed: ' + ($allowed -join ', '))
    }
    if (-not $targets.Contains($item)) { $targets.Add($item) | Out-Null }
  }
  if ($targets.Count -eq 0) { $targets.Add('aarch64') | Out-Null }
  return @($targets)
}

function Get-GradleUserHome([string]$RootPath, $Config) {
  $manual = (Get-KeyApiValue $Config 'GRADLE_USER_HOME')
  if (-not [string]::IsNullOrWhiteSpace($manual)) { return $manual }
  return (Join-Path $RootPath 'ANDROID\.gradle-user-home')
}


function Convert-ApkTargetsToRustTargets([string[]]$TargetNames) {
  $map = @{
    'aarch64' = 'aarch64-linux-android'
    'armv7' = 'armv7-linux-androideabi'
    'i686' = 'i686-linux-android'
    'x86_64' = 'x86_64-linux-android'
  }
  $result = New-Object 'System.Collections.Generic.List[string]'
  foreach ($item in $TargetNames) {
    if ($map.ContainsKey($item)) {
      $value = [string]$map[$item]
      if (-not $result.Contains($value)) { $result.Add($value) | Out-Null }
    }
  }
  return @($result)
}

function Get-MissingRustTargetsForBuild([string[]]$TargetNames) {
  $requiredTargets = @(Convert-ApkTargetsToRustTargets $TargetNames)
  if (@($requiredTargets).Count -eq 0) { return @() }
  if (-not (Has-Command 'rustup')) { return $requiredTargets }
  $installed = Convert-ToSafeArray (& rustup target list --installed)
  if ($LASTEXITCODE -ne 0) { return $requiredTargets }
  $missing = @()
  foreach ($target in $requiredTargets) {
    if ($installed -notcontains $target) { $missing += $target }
  }
  return @($missing)
}

$Root = Get-ProjectRoot
$Config = Read-KeyApiConfig $Root
$PackageJsonPath = Join-Path $Root 'package.json'
$LogsDir = Join-Path $Root 'logs'
$ReadyDir = Join-Path $Root 'ANDROID\READY'
$AndroidGenDir = Join-Path $Root 'src-tauri\gen\android'
$GradlePath = Join-Path $AndroidGenDir 'gradlew.bat'
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogPath = Join-Path $LogsDir ('apk_build_' + $Timestamp + '.log')
$LatestLogPath = Join-Path $LogsDir 'apk_build_LATEST.log'
$LegacyLatestLogPath = Join-Path $LogsDir 'android_build_LATEST.log'
$pushOk = $false
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReadyDir | Out-Null
$script:LiveLogTargets = @($LogPath, $LatestLogPath, $LegacyLatestLogPath)
foreach ($target in $script:LiveLogTargets) { try { Set-Content -Path $target -Value @() -Encoding UTF8 } catch {} }

try {
  if (-not (Test-Path $PackageJsonPath)) {
    Fail 'package.json was not found. Run ANDROID\APK_BUILD.bat from the project folder.'
  }

  $Package = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
  $packageScripts = $null
  if ($Package -and ($Package.PSObject.Properties.Name -contains 'scripts')) { $packageScripts = $Package.scripts }
  $tauriScriptValue = ''
  if ($packageScripts -and ($packageScripts.PSObject.Properties.Name -contains 'tauri')) { $tauriScriptValue = [string]$packageScripts.tauri }
  if ([string]::IsNullOrWhiteSpace($tauriScriptValue)) {
    Log 'package.json is missing the base npm script "tauri". Adding "tauri": "npx tauri" for Android Gradle compatibility.'
    $packageJsonText = Get-Content $PackageJsonPath -Raw
    if ($packageJsonText -match '"scripts"\s*:\s*\{') {
      $packageJsonText = [regex]::Replace($packageJsonText, '("scripts"\s*:\s*\{)', "`$1`r`n    `"tauri`": `"npx tauri`",", 1)
      Set-Content -Path $PackageJsonPath -Value $packageJsonText -Encoding UTF8
      $Package = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    }
    else {
      Fail 'package.json does not contain a scripts block. Add "tauri": "npx tauri" to scripts and run ANDROID\APK_BUILD.bat again.'
    }
  }

  $Version = [string]$Package.version
  if ([string]::IsNullOrWhiteSpace($Version)) { $Version = '0.5.8' }
  $AppName = 'LoversCalendar'
  $CloudModeDescription = Get-CloudModeDescription $Config
  $buildProfile = Get-ApkBuildProfile $Config
  $buildTargets = @(Get-ApkBuildTargets $Config)

  Write-Section 'ANDROID APK BUILD'
  Log ('Project version: ' + $Version)
  Log ('Project folder: ' + $Root)
  Log ('KEY_API: ' + (Get-KeyApiPath $Root))
  Log ('App mode: ' + $CloudModeDescription)
  Log ''

  foreach ($requiredCmd in @('node', 'npm', 'cargo', 'rustup')) {
    if (-not (Has-Command $requiredCmd)) {
      Fail ($requiredCmd + ' was not found. Install it and run ANDROID\APK_BUILD.bat again.')
    }
  }

  $sdkRoot = Find-AndroidSdkRoot $Config
  if (-not $sdkRoot) { Fail 'Android SDK was not found. Set ANDROID_SDK_ROOT in KEY_API or install Android Studio SDK.' }

  $javaHome = Find-JavaHome $Config
  if (-not $javaHome) { Fail 'JAVA_HOME / JBR was not found. Set JAVA_HOME in KEY_API or use the JBR from Android Studio.' }

  $sdkManager = Find-SdkManager $sdkRoot
  if (-not $sdkManager) { Fail 'sdkmanager was not found. Install Android SDK Command-line Tools.' }

  $missingSdkParts = @(Get-MissingAndroidSdkParts $sdkRoot)
  $missingWithoutNdk = @($missingSdkParts | Where-Object { $_ -and $_ -ne 'ndk' })
  if (@($missingWithoutNdk).Count -gt 0) {
    Fail ('Android SDK is missing folders: ' + (Join-SafeItems $missingWithoutNdk ', ') + '. Install them in Android Studio > SDK Manager.')
  }

  $online = Test-InternetConnection
  $networkState = if ($online) { 'network available' } else { 'offline' }

  $ndkHome = Find-NdkHome $Config $sdkRoot
  $signingConfig = Get-ApkSigningConfig $Root $Config $javaHome
  $gradleUserHome = Get-GradleUserHome $Root $Config
  if (-not $ndkHome -and $online) {
    $installResult = Try-InstallNdk $sdkManager $sdkRoot
    Log $installResult.Message
    if ($installResult.Success) {
      $ndkHome = Find-NdkHome $Config $sdkRoot
    }
  }
  if (-not $ndkHome) {
    Fail 'NDK_HOME was not found. Enable NDK (Side by side) in Android Studio SDK Manager or fill NDK_HOME in KEY_API.'
  }

  $rustHost = Get-RustHostTriple
  $hostNeedsMsvc = Test-RustHostNeedsMsvc $rustHost
  $msvcState = Get-MsvcState $Config
  if (-not $hostNeedsMsvc) {
    Log ('Rust host toolchain: ' + $rustHost)
    Log 'Rust host note: this host does not require the MSVC pre-check.'
  }
  elseif (-not ($msvcState.Ready -or $msvcState.LinkPath -or $msvcState.EnvScript -or $msvcState.InstallPath)) {
    Log ('WARNING: MSVC host toolchain was not detected automatically: ' + $msvcState.Comment)
    Log 'WARNING: The build will still continue and try the real tauri android route. If Cargo fails later on link.exe or kernel32.lib, install Visual Studio Build Tools with Desktop development with C++ and Windows SDK.'
  }

  $windowsSdk = Get-WindowsSdkState $Config

  Log ('ANDROID_SDK_ROOT: ' + $sdkRoot)
  Log ('JAVA_HOME: ' + $javaHome)
  Log ('NDK_HOME: ' + $ndkHome)
  if ([string]::IsNullOrWhiteSpace($rustHost)) {
    Log 'Rust host toolchain: unknown'
  }
  else {
    Log ('Rust host toolchain: ' + $rustHost)
  }
  Log ('MSVC source: ' + $msvcState.InstallPath)
  Log ('MSVC env script: ' + $msvcState.EnvScript)
  Log ('MSVC linker: ' + $msvcState.LinkPath)
  Log ('MSVC note: ' + $msvcState.Comment)
  if ($hostNeedsMsvc -and -not $msvcState.Ready) {
    Log 'WARNING: MSVC host route is only partially ready. The build will still try the real tauri android route through env script / current host environment.'
  }
  if ($hostNeedsMsvc) {
    Log 'MSVC manual KEY_API fields (optional): VSINSTALLDIR, VSDEVCMD_BAT, VCVARS_BAT, WINDOWS_SDK_DIR, WINDOWS_SDK_VERSION.'
    Log 'If Build Tools are not installed yet, run ANDROID\INSTALL_MSVC_BUILD_TOOLS.bat as administrator.'
  }
  if ($windowsSdk.Ready) {
    Log ('Windows SDK: ' + $windowsSdk.Root)
    Log ('Windows SDK version: ' + $windowsSdk.Version)
    Log ('kernel32.lib: ' + $windowsSdk.Kernel32Path)
  }
  else {
    Log 'WARNING: Windows SDK was not detected automatically. The build will still try vcvars env. If kernel32.lib fails later, enable Windows SDK in Visual Studio Installer.'
  }
  Log ('sdkmanager: ' + $sdkManager)
  Log ('Network state for install steps: ' + $networkState)
  Log 'App note: local mode without API keys is allowed. Cloud sync can return later when keys are filled and network is available.'
  Log ('APK build profile: ' + $buildProfile)
  Log ('APK targets: ' + (Join-SafeItems $buildTargets ', '))
  Log ('GRADLE_USER_HOME: ' + $gradleUserHome)
  Log ('APK signing mode: ' + $signingConfig.DisplayMode)
  if ($signingConfig.Enabled) {
    Ensure-ApkSigningKeystore $signingConfig
    Log ('APK keystore: ' + $signingConfig.KeystorePath)
    Log ('APK key alias: ' + $signingConfig.Alias)
  }

  $missingRustTargets = @(Get-MissingRustTargetsForBuild $buildTargets)
  if (@($missingRustTargets).Count -gt 0) {
    if (-not $online) {
      Fail ('Missing Rust Android target while offline: ' + (Join-SafeItems $missingRustTargets ', '))
    }
    Log ('Installing missing Rust Android target: ' + (Join-SafeItems $missingRustTargets ', '))
    & rustup target add @missingRustTargets
    if ($LASTEXITCODE -ne 0) { Fail 'rustup target add failed.' }
  }
  else {
    Log 'All required Rust Android targets are already installed.'
  }

  Push-Location $Root
  $pushOk = $true

  $nodeModulesReady = Test-NodeModulesReady $Root $Package
  $missingNodePackages = @()
  if (-not $nodeModulesReady) {
    $missingNodePackages = @(Get-MissingNodePackages $Root $Package)
  }

  if (-not $nodeModulesReady -and -not $online) {
    if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
      Fail 'Offline and node_modules is missing. The first Android build needs internet at least for npm install.'
    }

    $tauriVersionsOk = Test-TauriNodeModulesMatch $Root $Package
    if (-not $tauriVersionsOk) {
      Fail 'Offline and node_modules does not match package.json for Tauri packages. Connect internet and run ANDROID\APK_BUILD.bat again.'
    }

    $missingPreview = Join-SafeItems ($missingNodePackages | Select-Object -First 8) ', '
    if (-not [string]::IsNullOrWhiteSpace($missingPreview)) {
      Fail ('Offline and node_modules is missing packages: ' + $missingPreview)
    }
  }

  if ($nodeModulesReady) {
    Log 'node_modules already matches package.json. Skipping npm install.'
  }
  else {
    if (-not $online) {
      Fail 'node_modules is not ready and network is offline. Connect internet and run ANDROID\APK_BUILD.bat again.'
    }
    Log 'Running npm install to sync node_modules and build versions...'
    & npm install --include=dev --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }

    if (-not (Test-NodeModulesReady $Root $Package)) {
      Fail 'npm install finished without a direct error, but node_modules still does not match package.json.'
    }
  }

  $keyApiScript = Join-Path $Root 'scripts\apply-key-api.mjs'
  if (Test-Path $keyApiScript) {
    Log 'Updating .env.local from KEY_API...'
    & node $keyApiScript
    if ($LASTEXITCODE -ne 0) { Fail 'Failed to update .env.local from KEY_API.' }
  }

  New-Item -ItemType Directory -Force -Path $gradleUserHome | Out-Null

  $envMap = @{
    'ANDROID_HOME' = $sdkRoot
    'ANDROID_SDK_ROOT' = $sdkRoot
    'JAVA_HOME' = $javaHome
    'NDK_HOME' = $ndkHome
    'GRADLE_USER_HOME' = $gradleUserHome
  }

  if (-not (Test-Path $GradlePath)) {
    Log 'Android project was not generated yet. Running tauri android init...'
    $initExit = [int](Invoke-CmdWithToolchain $Root 'npm run tauri:android:init' $msvcState $windowsSdk $envMap)
    Log ('tauri android init exit code: ' + $initExit)
    if ($initExit -ne 0) { Fail 'tauri android init failed.' }
  }
  else {
    Log 'Android project already exists. Skipping tauri android init.'
  }

  $applyAssetsScript = Join-Path $Root 'scripts\apply-android-mobile-assets.mjs'
  if (Test-Path $applyAssetsScript) {
    Log 'Applying mobile Android icons and assets...'
    & node $applyAssetsScript
    if ($LASTEXITCODE -ne 0) { Fail 'apply-android-mobile-assets.mjs failed.' }
  }

  $gradleBuildDir = Join-Path $AndroidGenDir 'app\build'
  if (Test-Path $gradleBuildDir) {
    Log 'Cleaning previous Android app\build folder for a cleaner rebuild...'
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $gradleBuildDir
  }

  $tauriArgs = New-Object 'System.Collections.Generic.List[string]'
  $tauriArgs.Add('npx') | Out-Null
  $tauriArgs.Add('tauri') | Out-Null
  $tauriArgs.Add('android') | Out-Null
  $tauriArgs.Add('build') | Out-Null
  $tauriArgs.Add('--apk') | Out-Null
  if ($buildProfile -eq 'debug') {
    $tauriArgs.Add('--debug') | Out-Null
  }
  foreach ($targetName in $buildTargets) {
    $tauriArgs.Add('--target') | Out-Null
    $tauriArgs.Add($targetName) | Out-Null
  }
  $tauriCommand = ($tauriArgs -join ' ')
  $runnerCommand = 'node scripts/run-with-log.mjs android-build "' + $tauriCommand + '"'

  Step ('Running tauri android build through cmd route: ' + $tauriCommand)
  $buildExit = [int](Invoke-CmdWithToolchain $Root $runnerCommand $msvcState $windowsSdk $envMap)
  Log ('tauri android build exit code: ' + $buildExit)
  if ($buildExit -ne 0) {
    $hint = Get-AndroidBuildFailureHint $Root
    if ($hint -match 'Gradle cache is corrupted') {
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $gradleUserHome 'caches\journal-1')
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $AndroidGenDir '.gradle')
      Log 'Detected corrupted Gradle cache. Local Gradle cache was cleaned. Run ANDROID\APK_BUILD.bat again.'
    }
    if ($hostNeedsMsvc -and ($hint -match 'linker' -or $hint -match 'Windows host linker' -or $hint -match 'kernel32\.lib')) {
      $hint += ' You can also run ANDROID\INSTALL_MSVC_BUILD_TOOLS.bat as administrator, or point KEY_API to an existing custom Visual Studio / Build Tools installation.'
    }
    Fail $hint
  }

  Step 'Tauri build command finished. Searching for generated APK files...'
  $apkRoot = Join-Path $AndroidGenDir 'app\build\outputs\apk'
  $apkFiles = @(Get-ChildItem -Path $apkRoot -Filter *.apk -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
  if (@($apkFiles).Count -eq 0) {
    Fail 'APK was not found after build. Check src-tauri\gen\android\app\build\outputs\apk.'
  }

  $profileName = if ($buildProfile -eq 'debug') { 'debug' } else { 'release' }
  $profileMatches = @($apkFiles | Where-Object { $_.FullName -match ('[\\/]' + $profileName + '[\\/]') -or $_.Name.ToLowerInvariant().Contains('-' + $profileName) })
  if (@($profileMatches).Count -eq 0) { $profileMatches = $apkFiles }

  $latestApk = $profileMatches[0].FullName
  $installableApk = $latestApk
  Step ('Latest generated APK: ' + $latestApk)
  Step 'Checking APK certificates...'
  $embeddedCertificateState = Get-ApkEmbeddedCertificateState $latestApk
  if ($embeddedCertificateState.Signed) {
    Log ('APK already contains META-INF signature files: ' + (Join-SafeItems $embeddedCertificateState.SignatureFiles ', '))
  }
  else {
    Log 'APK does not expose embedded META-INF signature files yet. Falling back to apksigner verification if needed.'
  }
  $hasCertificates = Test-ApkHasCertificates $latestApk $sdkRoot
  if (-not $hasCertificates -and $signingConfig.Enabled) {
    Step ('Built APK has no installable certificates yet. Signing for device install: ' + $latestApk)
    $signedResult = Sign-AndroidApk $latestApk $sdkRoot $signingConfig
    $installableApk = $signedResult.Path
    Step ('Installable signed APK: ' + $installableApk)
    $hasCertificates = Test-ApkHasCertificates $installableApk $sdkRoot
  }
  elseif (-not $hasCertificates -and -not $signingConfig.Enabled) {
    Log 'APK signing is disabled by KEY_API. READY would receive an unsigned APK.'
  }

  if (-not $hasCertificates) {
    Fail 'The final APK still does not contain installable certificates. READY was not updated.'
  }

  Step 'Copying installable APK into ANDROID\READY...'
  $versionedApk = Join-Path $ReadyDir ($AppName + '_' + $Version + '.apk')
  $latestNamedApk = Join-Path $ReadyDir ($AppName + '_latest.apk')
  $metaPath = Join-Path $ReadyDir 'LATEST_BUILD_INFO.txt'

  Get-ChildItem -Path $ReadyDir -Filter *.apk -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Copy-Item -Force $installableApk $versionedApk
  Copy-Item -Force $installableApk $latestNamedApk

  @(
    ('Project: ' + $AppName),
    ('Version: ' + $Version),
    ('Date: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
    ('APK unsigned source: ' + $latestApk),
    ('APK source: ' + $installableApk),
    ('APK build profile: ' + $buildProfile),
    ('APK targets: ' + (Join-SafeItems $buildTargets ', ')),
    ('APK signing mode: ' + $signingConfig.DisplayMode),
    ('APK has certificates: ' + $(if ($hasCertificates) { 'yes' } else { 'no' })),
    ('Copied to: ' + $versionedApk),
    ('Latest copy: ' + $latestNamedApk),
    ('ANDROID_SDK_ROOT: ' + $sdkRoot),
    ('JAVA_HOME: ' + $javaHome),
    ('NDK_HOME: ' + $ndkHome),
    ('GRADLE_USER_HOME: ' + $gradleUserHome),
    ('MSVC env script: ' + $msvcState.EnvScript),
    ('Windows SDK: ' + $windowsSdk.Root),
    ('Windows SDK version: ' + $windowsSdk.Version),
    ('Network during build: ' + $networkState),
    ('App mode: ' + $CloudModeDescription),
    ('Main log: ' + $LatestLogPath),
    ('Tauri npm route log: ' + (Join-Path $LogsDir 'android-build_LATEST.log'))
  ) | Set-Content -Path $metaPath -Encoding UTF8

  Log ''
  Step 'Build pipeline is complete. APK saved here:'
  Log $versionedApk
  Log $latestNamedApk
}
catch {
  Log ''
  $msg = $_.Exception.Message
  if ($_.InvocationInfo) {
    $line = $_.InvocationInfo.ScriptLineNumber
    if ($line) { $msg = $msg + ' [line ' + $line + ']' }
  }
  Log ('ERROR: ' + $msg)
  exit 1
}
finally {
  if ($pushOk) { Pop-Location }
  $script:Lines | Set-Content -Path $LogPath -Encoding UTF8
  Copy-Item -Force $LogPath $LatestLogPath
  Copy-Item -Force $LogPath $LegacyLatestLogPath
}
