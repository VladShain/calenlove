﻿$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Write-Section([string]$Text) {
  Write-Host ''
  Write-Host '=================================================='
  Write-Host $Text
  Write-Host '=================================================='
}

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

function Test-InternetConnection {
  try {
    $null = Invoke-WebRequest -Uri 'https://registry.npmjs.org/' -Method Head -UseBasicParsing -TimeoutSec 6
    return $true
  }
  catch {
    return $false
  }
}

function Get-KeyApiPath([string]$RootPath) {
  foreach ($candidateName in @('KEY_API', 'KEY_API.txt')) {
    $candidatePath = Join-Path $RootPath $candidateName
    if (Test-Path $candidatePath) {
      return $candidatePath
    }
  }
  return (Join-Path $RootPath 'KEY_API')
}

function Read-KeyApiConfig([string]$RootPath) {
  $result = @{}
  $path = Get-KeyApiPath $RootPath
  if (-not (Test-Path $path)) { return $result }

  foreach ($rawLine in (Get-Content $path -ErrorAction SilentlyContinue)) {
    $line = $rawLine.Trim().TrimStart([char]0xFEFF)
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.StartsWith('#') -or $line.StartsWith(';') -or $line.StartsWith('//')) { continue }
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) { continue }
    $key = $parts[0].Trim().TrimStart([char]0xFEFF)
    $value = $parts[1].Trim()
    if (-not [string]::IsNullOrWhiteSpace($key)) {
      $result[$key] = $value
    }
  }

  return $result
}

function Get-KeyApiValue($Config, [string]$Name) {
  if ($Config.ContainsKey($Name)) {
    return [string]$Config[$Name]
  }
  return ''
}

function Get-ModeDescription($Config) {
  $url = Get-KeyApiValue $Config 'VITE_SUPABASE_URL'
  $key = Get-KeyApiValue $Config 'VITE_SUPABASE_ANON_KEY'
  if (-not [string]::IsNullOrWhiteSpace($url) -and -not [string]::IsNullOrWhiteSpace($key)) {
    return 'cloud'
  }
  return 'local'
}

$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$LogsDir = Join-Path $Root 'logs'
$ReadyDir = Join-Path $Root 'SERVER\READY'
$NodeModulesDir = Join-Path $Root 'node_modules'
$DistDir = Join-Path $Root 'dist'
$PackageJsonPath = Join-Path $Root 'package.json'
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogPath = Join-Path $LogsDir ("server_build_{0}.log" -f $Timestamp)
$LatestLogPath = Join-Path $LogsDir 'server_build_LATEST.log'
$script:Lines = New-Object System.Collections.Generic.List[string]
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReadyDir | Out-Null
$pushedLocation = $false

try {
  if (-not (Test-Path $PackageJsonPath)) {
    Fail 'package.json не найден. Запускай сборщик внутри папки проекта.'
  }

  if (-not (Has-Command 'node')) { Fail 'Node.js не найден. Установи Node LTS.' }
  if (-not (Has-Command 'npm')) { Fail 'npm не найден. Переустанови Node LTS.' }

  $Package = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
  $Version = [string]$Package.version
  $Config = Read-KeyApiConfig $Root
  $Mode = Get-ModeDescription $Config
  $ArchiveBaseName = Get-KeyApiValue $Config 'SERVER_ARCHIVE_NAME'
  if ([string]::IsNullOrWhiteSpace($ArchiveBaseName)) {
    $ArchiveBaseName = 'LoversCalendar_server'
  }

  Write-Section 'СБОРКА SERVER ПАКЕТА'
  Log ("Версия проекта: {0}" -f $Version)
  Log ("Папка проекта: {0}" -f $Root)
  Log ("KEY_API: {0}" -f (Get-KeyApiPath $Root))
  Log ("Режим данных: {0}" -f $Mode)
  Log ''

  $online = Test-InternetConnection
  if (Test-Path $NodeModulesDir) {
    Log 'node_modules уже есть. Пропускаю npm install.'
  }
  elseif ($online) {
    Log 'node_modules нет. Запускаю npm install...'
    Push-Location $Root
    $pushedLocation = $true
    & npm install
    if ($LASTEXITCODE -ne 0) { Fail 'npm install завершился с ошибкой.' }
    Pop-Location
    $pushedLocation = $false
  }
  else {
    Fail 'Сети нет и node_modules отсутствует. Для первого server build нужен интернет хотя бы на шаг npm install.'
  }

  $keyApiScript = Join-Path $Root 'scripts\apply-key-api.mjs'
  if (Test-Path $keyApiScript) {
    Log 'Обновляю .env.local из KEY_API...'
    Push-Location $Root
    $pushedLocation = $true
    & node $keyApiScript
    if ($LASTEXITCODE -ne 0) { Fail 'Не удалось обновить .env.local из KEY_API.' }
    Pop-Location
    $pushedLocation = $false
  }

  Log 'Собираю web dist...'
  Push-Location $Root
  $pushedLocation = $true
  & npm run build
  if ($LASTEXITCODE -ne 0) { Fail 'npm run build завершился с ошибкой.' }
  Pop-Location
  $pushedLocation = $false

  if (-not (Test-Path $DistDir)) {
    Fail 'dist не найден после билда.'
  }

  $packageDirName = "{0}_{1}" -f $ArchiveBaseName, $Version
  $packageDir = Join-Path $ReadyDir $packageDirName
  $zipPath = Join-Path $ReadyDir ($packageDirName + '.zip')
  $latestZipPath = Join-Path $ReadyDir ($ArchiveBaseName + '_latest.zip')
  $metaPath = Join-Path $ReadyDir 'LATEST_SERVER_BUILD_INFO.txt'

  if (Test-Path $packageDir) { Remove-Item -Recurse -Force $packageDir }
  if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

  New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
  Copy-Item -Recurse -Force $DistDir (Join-Path $packageDir 'public')
  Copy-Item -Force (Join-Path $Root 'SERVER\server.js') (Join-Path $packageDir 'server.js')
  Copy-Item -Force (Join-Path $Root 'SERVER\AUTO_UNPACK_AND_START.sh') (Join-Path $packageDir 'AUTO_UNPACK_AND_START.sh')
  Copy-Item -Force (Join-Path $Root 'SERVER\SERVER_ENV.txt') (Join-Path $packageDir 'SERVER_ENV.txt')

  @(
    'SERVER PACKAGE',
    '',
    'Содержимое этой папки можно загрузить на сервер.',
    'После загрузки запусти AUTO_UNPACK_AND_START.sh.',
    '',
    ('Версия: {0}' -f $Version),
    ('Режим данных: {0}' -f $Mode),
    ('SERVER_PUBLIC_URL: {0}' -f (Get-KeyApiValue $Config 'SERVER_PUBLIC_URL')),
    ('SERVER_HOST: {0}' -f (Get-KeyApiValue $Config 'SERVER_HOST')),
    ('SERVER_PORT: {0}' -f (Get-KeyApiValue $Config 'SERVER_PORT'))
  ) | Set-Content -Path (Join-Path $packageDir 'README.txt') -Encoding UTF8

  Compress-Archive -Path (Join-Path $packageDir '*') -DestinationPath $zipPath -Force
  Copy-Item -Force $zipPath $latestZipPath

  @(
    ('Проект: LoversCalendar'),
    ('Версия: {0}' -f $Version),
    ('Дата: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
    ('Режим данных: {0}' -f $Mode),
    ('Папка пакета: {0}' -f $packageDir),
    ('Архив: {0}' -f $zipPath),
    ('Последний архив: {0}' -f $latestZipPath)
  ) | Set-Content -Path $metaPath -Encoding UTF8

  Log ''
  Log 'Готово. Server-пакет сохранён сюда:'
  Log $packageDir
  Log $zipPath
  Log $latestZipPath
}
catch {
  Log ''
  Log ('ОШИБКА: ' + $_.Exception.Message)
  exit 1
}
finally {
  if ($pushedLocation) { Pop-Location }
  $script:Lines | Set-Content -Path $LogPath -Encoding UTF8
  Copy-Item -Force $LogPath $LatestLogPath
}
