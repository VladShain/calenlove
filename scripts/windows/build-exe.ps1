$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Log([string]$Text) {
  Write-Host $Text
  $script:Lines.Add($Text) | Out-Null
}

function Fail([string]$Message) {
  throw $Message
}

function Has-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-Net {
  try {
    $null = Invoke-WebRequest -Uri 'https://registry.npmjs.org/' -Method Head -UseBasicParsing -TimeoutSec 6
    return $true
  }
  catch {
    return $false
  }
}

$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$LogsDir = Join-Path $Root 'logs'
$ReadyDir = Join-Path $Root 'EXE\READY'
New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
New-Item -ItemType Directory -Path $ReadyDir -Force | Out-Null
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogFile = Join-Path $LogsDir "exe_build_$Timestamp.log"
$LatestLog = Join-Path $LogsDir 'exe_build_LATEST.log'
$Package = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$AppName = 'LoversCalendar'
$NodeModulesDir = Join-Path $Root 'node_modules'
$script:Lines = New-Object System.Collections.Generic.List[string]

try {
  Log '========================================'
  Log ("LOVERS CALENDAR {0}" -f $Version)
  Log 'WINDOWS EXE BUILD'
  Log '========================================'
  Log ''

  if (-not (Has-Command 'node.exe')) { Fail 'Node.js was not found. Install Node LTS.' }
  if (-not (Has-Command 'npm.cmd')) { Fail 'npm was not found. Reinstall Node LTS.' }
  if (-not (Has-Command 'npx.cmd')) { Fail 'npx was not found. Reinstall Node LTS.' }
  if (-not (Has-Command 'cargo.exe')) { Fail 'cargo was not found. Install rustup.' }
  if (-not (Has-Command 'rustc.exe')) { Fail 'rustc was not found. Install rustup.' }

  $clFound = $null -ne (Get-Command 'cl.exe' -ErrorAction SilentlyContinue)
  $vsWherePath = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not $clFound -and -not (Test-Path $vsWherePath)) {
    Fail 'MSVC Build Tools were not found. Install Visual Studio Build Tools with Desktop C++.'
  }

  $online = Test-Net
  $networkState = 'offline'
  if ($online) { $networkState = 'online' }

  Log ("Version: {0}" -f $Version)
  Log ("Network for npm: {0}" -f $networkState)
  Log 'App network note: the calendar can work locally offline; cloud sync resumes after network returns when .env is configured.'

  Push-Location $Root
  try {
    $keyApiScript = Join-Path $Root 'scripts\apply-key-api.mjs'
    if ((Test-Path $keyApiScript) -and (Has-Command 'node.exe')) {
      Log 'Applying KEY_API to .env.local...'
      & node $keyApiScript
      if ($LASTEXITCODE -ne 0) { Fail 'KEY_API apply step failed.' }
    }
    if ($online) {
      Log 'Running npm install...'
      & npm.cmd install
      if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }
    }
    elseif (Test-Path $NodeModulesDir) {
      Log 'node_modules already exists. Skipping npm install and continuing offline.'
    }
    else {
      Fail 'No network and node_modules is missing. The first EXE build needs internet at least for npm install.'
    }

    Log 'Running tauri build for portable exe...'
    & npx.cmd tauri build --no-bundle --no-sign
    if ($LASTEXITCODE -ne 0) { Fail 'tauri build failed.' }
  }
  finally {
    Pop-Location
  }

  $releaseExe = Join-Path $Root 'src-tauri\target\release\LoversCalendar.exe'
  if (-not (Test-Path $releaseExe)) {
    Fail 'LoversCalendar.exe was not found after build.'
  }

  $versionedExe = Join-Path $ReadyDir ("{0}_{1}.exe" -f $AppName, $Version)
  $latestExe = Join-Path $ReadyDir ("{0}_latest.exe" -f $AppName)
  $infoPath = Join-Path $ReadyDir 'LATEST_BUILD_INFO.txt'

  Copy-Item -Force $releaseExe $versionedExe
  Copy-Item -Force $releaseExe $latestExe

  @(
    ("Project: {0}" -f $AppName),
    ("Version: {0}" -f $Version),
    ("Date: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
    ("Source EXE: {0}" -f $releaseExe),
    ("Copied to: {0}" -f $versionedExe),
    ("Latest copy: {0}" -f $latestExe),
    ("Network during build: {0}" -f $networkState),
    'App network note: local offline mode works; cloud sync resumes after network returns when .env is configured.'
  ) | Set-Content -Path $infoPath -Encoding UTF8

  Log ''
  Log 'Build finished. EXE copied to:'
  Log $versionedExe
  Log $latestExe
}
catch {
  Log ''
  Log ('ERROR: ' + $_.Exception.Message)
  throw
}
finally {
  $script:Lines | Set-Content -Path $LogFile -Encoding UTF8
  Copy-Item -Force $LogFile $LatestLog
}
