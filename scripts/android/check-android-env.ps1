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

function Log([string]$Text = '') {
  Write-Host $Text
  $script:Lines.Add([string]$Text) | Out-Null
}

$Root = Get-ProjectRoot
$Config = Read-KeyApiConfig $Root
$LogsDir = Join-Path $Root 'logs'
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogPath = Join-Path $LogsDir ('android_env_check_' + $Timestamp + '.log')
$LatestLogPath = Join-Path $LogsDir 'android_env_check_LATEST.log'
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

Write-Section 'ANDROID ENV CHECK'

try {
  $sdkRoot = Find-AndroidSdkRoot $Config
  $javaHome = Find-JavaHome $Config
  $ndkHome = Find-NdkHome $Config $sdkRoot
  $sdkManager = Find-SdkManager $sdkRoot
  $rustHost = Get-RustHostTriple
  $hostNeedsMsvc = Test-RustHostNeedsMsvc $rustHost
  $msvcState = Get-MsvcState $Config
  $windowsSdk = Get-WindowsSdkState $Config
  $networkState = if (Test-InternetConnection) { 'network available' } else { 'offline' }

  Log ('Project folder: ' + $Root)
  Log ('KEY_API: ' + (Get-KeyApiPath $Root))
  Log ('node: ' + (Get-CommandVersionSafe 'node' @('--version')))
  Log ('npm: ' + (Get-CommandVersionSafe 'npm' @('--version')))
  Log ('cargo: ' + (Get-CommandVersionSafe 'cargo' @('--version')))
  Log ('rustup: ' + (Get-CommandVersionSafe 'rustup' @('--version')))
  if ([string]::IsNullOrWhiteSpace($rustHost)) {
    Log 'Rust host: unknown'
  }
  else {
    Log ('Rust host: ' + $rustHost)
  }
  Log ('ANDROID_SDK_ROOT: ' + $sdkRoot)
  Log ('JAVA_HOME: ' + $javaHome)
  Log ('NDK_HOME: ' + $ndkHome)
  Log ('sdkmanager: ' + $sdkManager)
  Log ('MSVC source: ' + $msvcState.InstallPath)
  Log ('MSVC env script: ' + $msvcState.EnvScript)
  Log ('MSVC linker: ' + $msvcState.LinkPath)
  Log ('MSVC note: ' + $msvcState.Comment)
  Log ('Network: ' + $networkState)
  if ($windowsSdk.Ready) {
    Log ('Windows SDK: ' + $windowsSdk.Root)
    Log ('Windows SDK version: ' + $windowsSdk.Version)
    Log ('kernel32.lib: ' + $windowsSdk.Kernel32Path)
  }
  else {
    Log ('Windows SDK: ' + $windowsSdk.Comment)
  }
  Log ''

  $missingParts = @(Get-MissingAndroidSdkParts $sdkRoot)
  if (@($missingParts).Count -gt 0) {
    Log ('SDK PROBLEM: missing folders: ' + (Join-SafeItems $missingParts ', '))
  }

  $missingTargets = @(Get-MissingRustTargets)
  if (@($missingTargets).Count -gt 0) {
    Log ('RUST TARGET PROBLEM: missing targets: ' + (Join-SafeItems $missingTargets ', '))
  }

  Log ''
  if (-not $sdkRoot) { Log 'RESULT: Android SDK was not found.' }
  if (-not $javaHome) { Log 'RESULT: JAVA_HOME / JBR was not found.' }
  if (-not $ndkHome) { Log 'RESULT: NDK was not found.' }
  if (-not $sdkManager) { Log 'RESULT: sdkmanager was not found.' }
  if ($hostNeedsMsvc -and -not $msvcState.Ready) { Log ('RESULT: MSVC host route is partial or not ready: ' + $msvcState.Comment) }
  if ($hostNeedsMsvc) { Log 'RESULT: Optional KEY_API overrides for custom Visual Studio paths: VSINSTALLDIR, VSDEVCMD_BAT, VCVARS_BAT, WINDOWS_SDK_DIR, WINDOWS_SDK_VERSION.' }
  if ($hostNeedsMsvc -and -not $msvcState.Ready) { Log 'RESULT: If Build Tools are not installed yet, run ANDROID\INSTALL_MSVC_BUILD_TOOLS.bat as administrator.' }
  if (-not $hostNeedsMsvc) { Log 'RESULT: Rust host does not require the MSVC pre-check.' }

  if ($sdkRoot -and $javaHome -and $ndkHome -and $sdkManager) {
    if ($hostNeedsMsvc) {
      Log 'RESULT: Android route is allowed to continue. Run ANDROID\APK_BUILD.bat. If build later fails on link.exe or kernel32.lib, install Visual Studio Build Tools with Desktop development with C++ and Windows SDK.'
    }
    else {
      Log 'RESULT: Android host route looks usable. You can run ANDROID\APK_BUILD.bat.'
    }
  }
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
  $script:Lines | Set-Content -Path $LogPath -Encoding UTF8
  Copy-Item -Force $LogPath $LatestLogPath
}
