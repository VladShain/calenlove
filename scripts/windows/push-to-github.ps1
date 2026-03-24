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

function Read-KeyApiMap([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  foreach ($raw in (Get-Content -Path $Path -Encoding UTF8)) {
    $line = [string]$raw
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $trimmed = $line.Trim()
    if ($trimmed.StartsWith('#') -or $trimmed.StartsWith(';') -or $trimmed.StartsWith('//')) { continue }
    $eq = $trimmed.IndexOf('=')
    if ($eq -lt 1) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $value = $trimmed.Substring($eq + 1).Trim()
    if (-not [string]::IsNullOrWhiteSpace($key)) { $map[$key] = $value }
  }
  return $map
}

function Set-KeyApiValue([string]$Path, [string]$Key, [string]$Value) {
  $valueText = if ($null -eq $Value) { '' } else { [string]$Value }
  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path $Path) {
    foreach ($line in (Get-Content -Path $Path -Encoding UTF8)) {
      $lines.Add([string]$line) | Out-Null
    }
  }
  $pattern = '^(\s*' + [regex]::Escape($Key) + '\s*=).*$'
  $replaced = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Key=$valueText"
      $replaced = $true
      break
    }
  }
  if (-not $replaced) {
    if ($lines.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($lines[$lines.Count - 1])) {
      $lines.Add('') | Out-Null
    }
    $lines.Add("$Key=$valueText") | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($Path, $lines, $utf8NoBom)
}

function Get-GitConfigValue([string]$Key, [switch]$Global) {
  $args = @('config')
  if ($Global) { $args += '--global' }
  $args += @('--get', $Key)
  $result = & git.exe @args 2>$null
  if ($LASTEXITCODE -ne 0) { return '' }
  return ([string]$result).Trim()
}

function Set-GitConfigValue([string]$Key, [string]$Value, [switch]$Global) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  $args = @('config')
  if ($Global) { $args += '--global' }
  $args += @($Key, $Value)
  & git.exe @args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    if ($Global) { Fail ("Could not set global git config for $Key.") }
    else { Fail ("Could not set git config for $Key.") }
  }
}

function Normalize-RepoUrlToHttps([string]$RepoUrl) {
  if ([string]::IsNullOrWhiteSpace($RepoUrl)) { return '' }
  $trimmed = $RepoUrl.Trim()
  if ($trimmed -match '^git@github\.com:(.+)$') { return ('https://github.com/' + [string]$Matches[1]) }
  if ($trimmed -match '^https://[^@]+@github\.com/(.+)$') { return ('https://github.com/' + [string]$Matches[1]) }
  return $trimmed
}

function Get-GitHubOwnerFromUrl([string]$RepoUrl) {
  if ([string]::IsNullOrWhiteSpace($RepoUrl)) { return '' }
  if ($RepoUrl -match 'github\.com[:/]([^/]+)/([^/]+?)(\.git)?$') { return [string]$Matches[1] }
  return ''
}

function Get-GitHubActionsUrl([string]$RepoUrl) {
  if ([string]::IsNullOrWhiteSpace($RepoUrl)) { return '' }
  if ($RepoUrl -match 'github\.com[:/]([^/]+)/([^/]+?)(\.git)?$') {
    $owner = [string]$Matches[1]
    $repo = [string]$Matches[2]
    return "https://github.com/$owner/$repo/actions"
  }
  return ''
}

function Get-SafeNoReplyEmail([string]$Name, [string]$RepoUrl) {
  $base = ''
  if (-not [string]::IsNullOrWhiteSpace($Name)) { $base = $Name }
  if ([string]::IsNullOrWhiteSpace($base)) { $base = Get-GitHubOwnerFromUrl $RepoUrl }
  if ([string]::IsNullOrWhiteSpace($base)) { return '' }
  $safe = ($base -replace '[^a-zA-Z0-9._-]', '')
  if ([string]::IsNullOrWhiteSpace($safe)) { return '' }
  return "$safe@users.noreply.github.com"
}

function Get-BasicAuthHeader([string]$UserName, [string]$Token) {
  $pair = "$UserName`:$Token"
  $bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
  $base64 = [Convert]::ToBase64String($bytes)
  return ('AUTHORIZATION: basic ' + $base64)
}

function Remove-TrackedSecrets() {
  & git.exe rm --cached --ignore-unmatch KEY_API .env.local 2>$null | Out-Null
  $null = $LASTEXITCODE
}

function Read-SecureText([string]$PromptText) {
  $secure = Read-Host $PromptText -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

function Quote-CmdArgument([string]$Value) {
  $text = if ($null -eq $Value) { '' } else { [string]$Value }
  return '"' + ($text -replace '"', '\"') + '"'
}

function Read-TextFileLines([string]$Path) {
  if (-not (Test-Path $Path)) { return @() }
  return @(Get-Content -Path $Path -Encoding UTF8)
}

function Test-GitPushNeedsForceRetry([string]$PushText) {
  if ([string]::IsNullOrWhiteSpace($PushText)) { return $false }
  if ($PushText -match 'fetch first' -or $PushText -match 'non-fast-forward' -or $PushText -match 'failed to push some refs') { return $true }
  return $false
}

function Invoke-GitFetchBranch([string]$Branch) {
  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()
  try {
    $arguments = @('git.exe', 'fetch', '--prune', 'origin', $Branch) | ForEach-Object { Quote-CmdArgument $_ }
    $commandLine = ($arguments -join ' ') + ' 1> ' + (Quote-CmdArgument $stdoutPath) + ' 2> ' + (Quote-CmdArgument $stderrPath)
    & cmd.exe /d /c $commandLine | Out-Null
    $exitCode = $LASTEXITCODE
    $stdout = Read-TextFileLines $stdoutPath
    $stderr = Read-TextFileLines $stderrPath
    $combined = New-Object System.Collections.Generic.List[string]
    foreach ($line in @($stdout)) { $combined.Add([string]$line) | Out-Null }
    foreach ($line in @($stderr)) { $combined.Add([string]$line) | Out-Null }
    return @{ Output = @($combined); ExitCode = $exitCode }
  }
  finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $stdoutPath, $stderrPath
  }
}

function Get-GitPushFailureMessage([string]$PushText) {
  if ([string]::IsNullOrWhiteSpace($PushText)) {
    return 'git push failed and Git did not return a readable message. Open logs\github_push_LATEST.log and re-run the push after checking GITHUB_REPOSITORY_URL and GITHUB_PAT.'
  }
  if ($PushText -match 'refusing to allow a Personal Access Token to create or update workflow' -or ($PushText -match 'workflow' -and $PushText -match 'scope')) {
    return 'GitHub rejected the push because the token cannot update workflow files. Use a classic PAT with repo + workflow, or a fine-grained token with repository access plus Actions/Workflows write and Contents write.'
  }
  if ($PushText -match 'Repository not found') {
    return 'GitHub says repository not found. Check GITHUB_REPOSITORY_URL, repository visibility, and whether this account/token has access to the repository.'
  }
  if ($PushText -match 'Authentication failed' -or $PushText -match 'Invalid username or token') {
    return 'GitHub rejected the username or token. Check GITHUB_USERNAME, create a fresh PAT, and paste it again into KEY_API.'
  }
  if ($PushText -match 'Permission to .+ denied to .+') {
    return 'GitHub accepted the account but denied push access. Give this account write access to the repository, or use a token from an account that can push.'
  }
  if ($PushText -match 'could not read Username' -or $PushText -match 'terminal prompts disabled') {
    return 'Git could not read credentials in PAT mode. Re-enter GITHUB_PAT in KEY_API and keep GITHUB_FORCE_PAT=1.'
  }
  return 'git push with PAT failed. Open logs\github_push_LATEST.log to see the full Git output.'
}

function Invoke-GitPushWithPat([string]$UserName, [string]$Token, [string]$Branch, [string[]]$ExtraPushArgs = @()) {
  $authHeader = Get-BasicAuthHeader $UserName $Token
  $oldPrompt = $env:GIT_TERMINAL_PROMPT
  $oldGcmInteractive = $env:GCM_INTERACTIVE
  $oldAskPass = $env:GIT_ASKPASS
  $env:GIT_TERMINAL_PROMPT = '0'
  $env:GCM_INTERACTIVE = 'never'
  $env:GIT_ASKPASS = ''
  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()
  try {
    $pushArguments = @('push')
    foreach ($item in @($ExtraPushArgs)) {
      if (-not [string]::IsNullOrWhiteSpace([string]$item)) { $pushArguments += [string]$item }
    }
    $pushArguments += @('-u', 'origin', $Branch)
    $arguments = @(
      'git.exe',
      '-c', 'credential.helper=',
      '-c', 'core.askPass=',
      '-c', "http.https://github.com/.extraheader=$authHeader"
    )
    $arguments += $pushArguments
    $arguments = $arguments | ForEach-Object { Quote-CmdArgument $_ }
    $commandLine = ($arguments -join ' ') + ' 1> ' + (Quote-CmdArgument $stdoutPath) + ' 2> ' + (Quote-CmdArgument $stderrPath)
    & cmd.exe /d /c $commandLine | Out-Null
    $exitCode = $LASTEXITCODE
    $stdout = Read-TextFileLines $stdoutPath
    $stderr = Read-TextFileLines $stderrPath
    $combined = New-Object System.Collections.Generic.List[string]
    foreach ($line in @($stdout)) { $combined.Add([string]$line) | Out-Null }
    foreach ($line in @($stderr)) { $combined.Add([string]$line) | Out-Null }
    return @{ Output = @($combined); StdOut = @($stdout); StdErr = @($stderr); ExitCode = $exitCode }
  }
  finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $stdoutPath, $stderrPath
    $env:GIT_TERMINAL_PROMPT = $oldPrompt
    $env:GCM_INTERACTIVE = $oldGcmInteractive
    $env:GIT_ASKPASS = $oldAskPass
  }
}

$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$LogsDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
$Timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$LogFile = Join-Path $LogsDir "github_push_$Timestamp.log"
$LatestLog = Join-Path $LogsDir 'github_push_LATEST.log'
$KeyApiPath = Join-Path $Root 'KEY_API'
$script:Lines = New-Object System.Collections.Generic.List[string]

try {
  Log '========================================'
  Log 'LOVERS CALENDAR 0.9.2'
  Log 'GITHUB PUSH FOR IOS CLOUD BUILD'
  Log '========================================'
  Log ''

  if (-not (Has-Command 'git.exe')) { Fail 'Git was not found. Install Git for Windows and run this file again.' }

  $keyMap = Read-KeyApiMap $KeyApiPath
  $repoUrl = ''
  $defaultBranch = 'main'
  $preferredUserName = ''
  $preferredUserEmail = ''
  $gitHubUserName = ''
  $gitHubPat = ''
  $forcePat = '1'

  if ($keyMap.ContainsKey('GITHUB_REPOSITORY_URL')) { $repoUrl = [string]$keyMap['GITHUB_REPOSITORY_URL'] }
  if ($keyMap.ContainsKey('GITHUB_DEFAULT_BRANCH') -and -not [string]::IsNullOrWhiteSpace([string]$keyMap['GITHUB_DEFAULT_BRANCH'])) { $defaultBranch = [string]$keyMap['GITHUB_DEFAULT_BRANCH'] }
  if ($keyMap.ContainsKey('GITHUB_GIT_USER_NAME')) { $preferredUserName = [string]$keyMap['GITHUB_GIT_USER_NAME'] }
  if ($keyMap.ContainsKey('GITHUB_GIT_USER_EMAIL')) { $preferredUserEmail = [string]$keyMap['GITHUB_GIT_USER_EMAIL'] }
  if ($keyMap.ContainsKey('GITHUB_USERNAME')) { $gitHubUserName = [string]$keyMap['GITHUB_USERNAME'] }
  if ($keyMap.ContainsKey('GITHUB_PAT')) { $gitHubPat = [string]$keyMap['GITHUB_PAT'] }
  if ($keyMap.ContainsKey('GITHUB_FORCE_PAT')) { $forcePat = [string]$keyMap['GITHUB_FORCE_PAT'] }

  Push-Location $Root
  try {
    if (-not (Test-Path (Join-Path $Root '.git'))) {
      Log 'Initializing git repository...'
      & git.exe init | Out-Null
      if ($LASTEXITCODE -ne 0) { Fail 'git init failed.' }
    }

    & git.exe config core.autocrlf false | Out-Null
    $null = $LASTEXITCODE
    & git.exe config core.safecrlf false | Out-Null
    $null = $LASTEXITCODE

    if ([string]::IsNullOrWhiteSpace($repoUrl)) {
      $existingOrigin = & git.exe remote get-url origin 2>$null
      if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace([string]$existingOrigin)) {
        $repoUrl = ([string]$existingOrigin).Trim()
        Log ('Found current origin: {0}' -f $repoUrl)
      }
    }

    if ([string]::IsNullOrWhiteSpace($repoUrl)) {
      $repoUrl = Read-Host 'Paste GitHub repository URL (https://github.com/...)'
    }
    if ([string]::IsNullOrWhiteSpace($repoUrl)) { Fail 'Repository URL is empty. Fill GITHUB_REPOSITORY_URL in KEY_API.' }

    $repoUrl = Normalize-RepoUrlToHttps $repoUrl
    if ($repoUrl -notmatch '^https://github\.com/') { Fail 'Use only an HTTPS GitHub repository URL in this patch.' }

    $gitUserName = Get-GitConfigValue 'user.name' -Global
    if ([string]::IsNullOrWhiteSpace($gitUserName)) { $gitUserName = $preferredUserName }
    if ([string]::IsNullOrWhiteSpace($gitUserName)) { $gitUserName = Get-GitHubOwnerFromUrl $repoUrl }
    if ([string]::IsNullOrWhiteSpace($gitUserName)) { $gitUserName = Read-Host 'Git user.name was not found. Enter a name for commit author' }
    if ([string]::IsNullOrWhiteSpace($gitUserName)) { Fail 'Git user.name is empty.' }
    Set-GitConfigValue 'user.name' $gitUserName -Global

    $gitUserEmail = Get-GitConfigValue 'user.email' -Global
    if ([string]::IsNullOrWhiteSpace($gitUserEmail)) { $gitUserEmail = $preferredUserEmail }
    if ([string]::IsNullOrWhiteSpace($gitUserEmail)) {
      $gitUserEmail = Get-SafeNoReplyEmail $gitUserName $repoUrl
      if (-not [string]::IsNullOrWhiteSpace($gitUserEmail)) {
        Log ('Using fallback email: {0}' -f $gitUserEmail)
      }
    }
    if ([string]::IsNullOrWhiteSpace($gitUserEmail)) { $gitUserEmail = Read-Host 'Git user.email was not found. Enter email for commit author' }
    if ([string]::IsNullOrWhiteSpace($gitUserEmail)) { Fail 'Git user.email is empty.' }
    Set-GitConfigValue 'user.email' $gitUserEmail -Global

    if ([string]::IsNullOrWhiteSpace($gitHubUserName)) { $gitHubUserName = Get-GitHubOwnerFromUrl $repoUrl }
    if ([string]::IsNullOrWhiteSpace($gitHubUserName)) { $gitHubUserName = $gitUserName }
    if ([string]::IsNullOrWhiteSpace($gitHubUserName)) { Fail 'GITHUB_USERNAME is empty.' }

    if ([string]::IsNullOrWhiteSpace($gitHubPat) -and $forcePat -eq '1') {
      Log 'Browser auth is disabled in this patch.'
      Log 'Paste GitHub PAT once. It will be saved locally to KEY_API and should not be committed.'
      $gitHubPat = Read-SecureText 'GitHub PAT'
    }
    if ([string]::IsNullOrWhiteSpace($gitHubPat) -and $forcePat -eq '1') {
      Fail 'GITHUB_PAT is empty. Create a GitHub PAT and run the file again.'
    }

    Set-KeyApiValue $KeyApiPath 'GITHUB_REPOSITORY_URL' $repoUrl
    Set-KeyApiValue $KeyApiPath 'GITHUB_DEFAULT_BRANCH' $defaultBranch
    Set-KeyApiValue $KeyApiPath 'GITHUB_GIT_USER_NAME' $gitUserName
    Set-KeyApiValue $KeyApiPath 'GITHUB_GIT_USER_EMAIL' $gitUserEmail
    Set-KeyApiValue $KeyApiPath 'GITHUB_USERNAME' $gitHubUserName
    Set-KeyApiValue $KeyApiPath 'GITHUB_PAT' $gitHubPat
    Set-KeyApiValue $KeyApiPath 'GITHUB_FORCE_PAT' $forcePat

    Log ('Switching branch to {0}...' -f $defaultBranch)
    & git.exe checkout -B $defaultBranch | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail 'Could not switch branch.' }

    $originExists = $false
    $remoteList = & git.exe remote
    if ($LASTEXITCODE -eq 0 -and ($remoteList -contains 'origin')) { $originExists = $true }

    if ($originExists) {
      Log 'Updating origin...'
      & git.exe remote set-url origin $repoUrl | Out-Null
      if ($LASTEXITCODE -ne 0) { Fail 'Could not update origin.' }
    }
    else {
      Log 'Adding origin...'
      & git.exe remote add origin $repoUrl | Out-Null
      if ($LASTEXITCODE -ne 0) { Fail 'Could not add origin.' }
    }

    Log 'Protecting local secrets from git...'
    Remove-TrackedSecrets

    Log 'Adding files to commit...'
    $addOutput = & git.exe add -A 2>&1
    foreach ($line in @($addOutput)) {
      $text = [string]$line
      if ([string]::IsNullOrWhiteSpace($text)) { continue }
      if ($text -like 'warning: in the working copy of*') { continue }
      Log $text
    }
    if ($LASTEXITCODE -ne 0) { Fail 'git add failed.' }

    $status = & git.exe status --porcelain
    if ($LASTEXITCODE -ne 0) { Fail 'git status failed.' }

    if ($status) {
      Log 'Creating commit 0.9.3.3.3...'
      & git.exe commit -m '0.9.2' | Out-Null
      if ($LASTEXITCODE -ne 0) { Fail 'git commit failed.' }
    }
    else {
      Log 'No new changes found. Pushing current state.'
    }

    if (-not [string]::IsNullOrWhiteSpace($gitHubPat)) {
      Log 'Pushing project to GitHub with PAT mode...'
      $pushResult = Invoke-GitPushWithPat -UserName $gitHubUserName -Token $gitHubPat -Branch $defaultBranch
      foreach ($line in $pushResult.Output) {
        $text = [string]$line
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        Log $text
      }
      if ($pushResult.ExitCode -ne 0) {
        $pushText = ($pushResult.Output | ForEach-Object { [string]$_ }) -join "`n"
        if (Test-GitPushNeedsForceRetry $pushText) {
          Log 'Remote branch already has commits. Fetching origin and retrying with force-with-lease for cloud build patch sync...'
          $fetchResult = Invoke-GitFetchBranch -Branch $defaultBranch
          foreach ($line in $fetchResult.Output) {
            $text = [string]$line
            if ([string]::IsNullOrWhiteSpace($text)) { continue }
            Log $text
          }
          Log 'Retrying push with force-with-lease...'
          $pushRetry = Invoke-GitPushWithPat -UserName $gitHubUserName -Token $gitHubPat -Branch $defaultBranch -ExtraPushArgs @('--force-with-lease')
          foreach ($line in $pushRetry.Output) {
            $text = [string]$line
            if ([string]::IsNullOrWhiteSpace($text)) { continue }
            Log $text
          }
          if ($pushRetry.ExitCode -ne 0) {
            $pushText = ($pushRetry.Output | ForEach-Object { [string]$_ }) -join "`n"
            $friendlyPushError = Get-GitPushFailureMessage $pushText
            Fail $friendlyPushError
          }
        }
        else {
          $friendlyPushError = Get-GitPushFailureMessage $pushText
          Fail $friendlyPushError
        }
      }
    }
    else {
      Log 'Pushing project to GitHub with default auth...'
      & git.exe push -u origin $defaultBranch
      if ($LASTEXITCODE -ne 0) { Fail 'git push failed.' }
    }
  }
  finally {
    Pop-Location
  }

  Log ''
  Log 'Done. If the workflow does not start automatically, open Actions and run ios-cloud-build manually.'
  $actionsUrl = Get-GitHubActionsUrl $repoUrl
  if (-not [string]::IsNullOrWhiteSpace($actionsUrl)) {
    Log ('Opening Actions: {0}' -f $actionsUrl)
    Start-Process $actionsUrl | Out-Null
  }
}
catch {
  Log ''
  Log ('ERROR: ' + $_.Exception.Message)
  throw
}
finally {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($LogFile, $script:Lines, $utf8NoBom)
  Copy-Item -Force $LogFile $LatestLog
}
