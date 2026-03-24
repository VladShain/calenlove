$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Fail([string]$Message, [int]$Code = 1) {
  Write-Host ''
  Write-Host ('[ERROR] ' + $Message) -ForegroundColor Red
  exit $Code
}

function Has-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
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
    $line = ([string]$rawLine).Trim().TrimStart([char]0xFEFF)
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.StartsWith('#') -or $line.StartsWith(';') -or $line.StartsWith('//')) { continue }
    $parts = @($line -split '=', 2)
    if (@($parts).Count -ne 2) { continue }
    $key = ([string]$parts[0]).Trim().TrimStart([char]0xFEFF)
    $value = ([string]$parts[1]).Trim()
    if (-not [string]::IsNullOrWhiteSpace($key)) { $result[$key] = $value }
  }
  return $result
}

function Get-KeyApiValue($Config, [string]$Name) {
  if ($null -ne $Config -and $Config.ContainsKey($Name)) { return [string]$Config[$Name] }
  return ''
}

function Get-CloudModeDescription($Config) {
  $url = Get-KeyApiValue $Config 'VITE_SUPABASE_URL'
  $key = Get-KeyApiValue $Config 'VITE_SUPABASE_ANON_KEY'
  if (-not [string]::IsNullOrWhiteSpace($url) -and -not [string]::IsNullOrWhiteSpace($key)) {
    return 'cloud mode enabled, but APK install still happens locally through adb'
  }
  return 'local mode: apk installs straight to the phone through adb'
}


function Find-AndroidBuildToolPath([string]$SdkRoot, [string]$ToolName) {
  if ([string]::IsNullOrWhiteSpace($SdkRoot)) { return $null }
  $root = Join-Path $SdkRoot 'build-tools'
  if (-not (Test-Path $root)) { return $null }
  $dirs = @(Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
  foreach ($dir in $dirs) {
    foreach ($candidateName in @(($ToolName + '.bat'), ($ToolName + '.exe'), $ToolName)) {
      $candidate = Join-Path $dir.FullName $candidateName
      if (Test-Path $candidate) { return $candidate }
    }
  }
  return $null
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
  if ($apksigner) {
    & $apksigner verify --print-certs $ApkPath | Out-Null
    return ($LASTEXITCODE -eq 0)
  }
  return $false
}

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ReadyDir = Join-Path $Root 'ANDROID\READY'
$Config = Read-KeyApiConfig $Root
$sdkRoot = (Get-KeyApiValue $Config 'ANDROID_SDK_ROOT')
if (-not $sdkRoot) { $sdkRoot = (Get-KeyApiValue $Config 'ANDROID_HOME') }
if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_SDK_ROOT }
if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_HOME }
if (-not $sdkRoot) { $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }

Write-Host ('Install mode: ' + (Get-CloudModeDescription $Config))
Write-Host ('KEY_API: ' + (Get-KeyApiPath $Root))

if (-not (Has-Command 'adb')) {
  $adbPath = Join-Path $sdkRoot 'platform-tools\adb.exe'
  if (Test-Path $adbPath) {
    $env:PATH = ((Split-Path $adbPath -Parent) + ';' + $env:PATH)
  }
}

if (-not (Has-Command 'adb')) {
  Fail 'adb was not found. Install Android platform-tools or set the SDK path in KEY_API.'
}

$apk = Get-ChildItem -Path $ReadyDir -Filter *.apk -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($apk -and ([System.IO.Path]::GetFileName($apk.FullName) -like '*-unsigned.apk')) {
  Fail 'The latest APK in ANDROID\READY is unsigned. Rebuild with ANDROID\APK_BUILD.bat from 0.5.8+ or set APK_SIGN_MODE=debug in KEY_API.'
}
if (-not $apk) {
  $generatedApkRoot = Join-Path $Root 'src-tauri\gen\android\app\build\outputs\apk'
  $apk = Get-ChildItem -Path $generatedApkRoot -Filter *.apk -File -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $apk) {
  Fail 'APK was not found in ANDROID\READY or src-tauri\gen\android\app\build\outputs\apk. Run ANDROID\APK_BUILD.bat first.'
}

if (-not (Test-ApkHasCertificates $apk.FullName $sdkRoot)) {
  Fail 'The selected APK still does not contain installable certificates. Rebuild through ANDROID\APK_BUILD.bat, wait until the final READY copy is printed, and then install only the APK from ANDROID\READY.'
}

$null = & adb start-server 2>$null
$devices = & adb devices
if ($LASTEXITCODE -ne 0) {
  Fail 'adb devices failed.'
}

$onlineDevice = $false
foreach ($line in $devices) {
  if ($line -match "\tdevice$") {
    $onlineDevice = $true
    break
  }
}
if (-not $onlineDevice) {
  Fail 'No phone in device mode was found. Enable USB debugging and confirm access for this PC.'
}

Write-Host 'Running adb start-server...'
& adb start-server | Out-Null
Write-Host ("Installing APK: {0}" -f $apk.FullName)
& adb install -r -d $apk.FullName
if ($LASTEXITCODE -ne 0) {
  Fail 'adb install failed.'
}

Write-Host 'Done. APK was installed locally to the phone.'
