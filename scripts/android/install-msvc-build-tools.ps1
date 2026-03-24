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

function Test-IsAdministrator {
  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  }
  catch {
    return $false
  }
}

$Root = Get-ProjectRoot
$Config = Read-KeyApiConfig $Root
$LogsDir = Join-Path $Root 'logs'
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogPath = Join-Path $LogsDir ('msvc_build_tools_install_' + $Timestamp + '.log')
$LatestLogPath = Join-Path $LogsDir 'msvc_build_tools_install_LATEST.log'
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

try {
  Write-Section 'MSVC BUILD TOOLS INSTALL'

  if (-not (Test-IsAdministrator)) {
    throw 'Administrator rights are required. Run ANDROID\INSTALL_MSVC_BUILD_TOOLS.bat as administrator.'
  }

  if (-not (Test-InternetConnection)) {
    throw 'Internet connection is required to download and install Visual Studio Build Tools.'
  }

  $installPath = Get-FirstConfigValue $Config @('VSINSTALLDIR', 'VS_INSTALL_PATH', 'VS_PATH', 'VS_BUILDTOOLS_PATH', 'VISUAL_STUDIO_PATH')
  if ([string]::IsNullOrWhiteSpace($installPath)) {
    $installPath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\2022\BuildTools'
  }

  $tempDir = Join-Path $env:TEMP 'LoversCalendar_MsvcInstaller'
  $bootstrapper = Join-Path $tempDir 'vs_BuildTools.exe'
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

  Log ('Project folder: ' + $Root)
  Log ('Install path: ' + $installPath)
  Log ('Download cache: ' + $bootstrapper)
  Log 'Workload: Microsoft.VisualStudio.Workload.VCTools'
  Log ''
  Log 'Downloading Visual Studio Build Tools bootstrapper...'

  Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -UseBasicParsing -OutFile $bootstrapper
  if (-not (Test-Path $bootstrapper)) {
    throw 'Failed to download vs_BuildTools.exe.'
  }

  $arguments = @(
    '--installPath', $installPath,
    '--add', 'Microsoft.VisualStudio.Workload.VCTools',
    '--includeRecommended',
    '--passive',
    '--wait',
    '--norestart'
  )

  Log ('Installer arguments: ' + ($arguments -join ' '))
  Log ''
  Log 'Starting Build Tools installer...'

  $process = Start-Process -FilePath $bootstrapper -ArgumentList $arguments -Wait -PassThru
  $exitCode = [int]$process.ExitCode
  Log ('Installer exit code: ' + $exitCode)

  if (($exitCode -ne 0) -and ($exitCode -ne 3010) -and ($exitCode -ne 1641)) {
    throw ('Visual Studio Build Tools installer failed. Exit code: ' + $exitCode + '. Open the latest log in %TEMP% that starts with dd_bootstrapper / dd_setup, then re-run ANDROID\\CHECK_ANDROID_ENV.bat.')
  }

  Log ''
  if ($exitCode -eq 3010 -or $exitCode -eq 1641) {
    Log 'Build Tools installation finished, but Windows requested a reboot before the tools are fully usable.'
  }
  else {
    Log 'Build Tools installation finished successfully.'
  }
  Log 'Next step: run ANDROID\CHECK_ANDROID_ENV.bat and then ANDROID\APK_BUILD.bat.'
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
