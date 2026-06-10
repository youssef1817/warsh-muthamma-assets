[CmdletBinding(PositionalBinding = $false)]
param(
  [int]$Page = 0,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = 'Stop'

function Write-Info($message) {
  Write-Host "[info] $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
  Write-Host "[ok] $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "[warn] $message" -ForegroundColor Yellow
}

function Resolve-PageNumber([string[]]$Args) {
  foreach ($arg in $Args) {
    if ($arg -match '^-?(\d{1,3})$') {
      $page = [int]$Matches[1]
      if ($page -ge 1 -and $page -le 485) {
        return $page
      }
    }
    if ($arg -match '^--page=(\d{1,3})$') {
      $page = [int]$Matches[1]
      if ($page -ge 1 -and $page -le 485) {
        return $page
      }
    }
  }
  throw "Pass a page number, for example: tools\sync_warsh_muthamma_ayahinfo.cmd -475"
}

function Resolve-WindowsQuranDataRoot {
  $candidates = @()

  if ($env:APPDATA) {
    $candidates += Join-Path $env:APPDATA 'al_quran\quran_data'
    $candidates += Join-Path $env:APPDATA 'com.quran.labs.androidquran\al_quran\quran_data'
  }
  if ($env:LOCALAPPDATA) {
    $candidates += Join-Path $env:LOCALAPPDATA 'al_quran\quran_data'
    $candidates += Join-Path $env:LOCALAPPDATA 'com.quran.labs.androidquran\al_quran\quran_data'
  }

  $existing = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($existing) {
    return $existing
  }

  return $candidates[0]
}

function Resolve-AdbPath {
  $adb = Get-Command adb -ErrorAction SilentlyContinue
  if ($adb) {
    return $adb.Source
  }

  $candidates = @()
  if ($env:ANDROID_HOME) {
    $candidates += Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  }
  if ($env:ANDROID_SDK_ROOT) {
    $candidates += Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe'
  }
  if ($env:LOCALAPPDATA) {
    $candidates += Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
  }

  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Invoke-AdbSync($SourceDb) {
  $adb = Resolve-AdbPath
  if (-not $adb) {
    Write-Warn 'adb was not found in PATH. Skipping Android sync.'
    return
  }

  $devices = & $adb devices | Select-String -Pattern "`tdevice$"
  if (-not $devices) {
    Write-Warn 'No adb device is connected. Skipping Android sync.'
    return
  }

  $remoteTmp = '/data/local/tmp/ayahinfo.db'
  & $adb push "$SourceDb" $remoteTmp | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Warn 'adb push failed.'
    return
  }

  $packages = @('com.diyyourz.alquran.debug', 'com.diyyourz.alquran')
  foreach ($pkg in $packages) {
    & $adb shell "run-as $pkg sh -c 'mkdir -p files/quran_data/databases/ayahinfo/warsh_muthamma && cp $remoteTmp files/quran_data/databases/ayahinfo/warsh_muthamma/ayahinfo.db && chmod 600 files/quran_data/databases/ayahinfo/warsh_muthamma/ayahinfo.db'"
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "Android ayahinfo.db was replaced under $pkg."
      return
    }
  }

  Write-Warn 'Android run-as copy failed. The installed app is probably not debug, or the package id differs.'
}

if ($Page -ge 1 -and $Page -le 485) {
  $page = $Page
} else {
  $page = Resolve-PageNumber $Rest
}
$assetsRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$dbDir = Join-Path $assetsRoot 'databases\ayahinfo\warsh_muthamma'
$sourceDb = Join-Path $dbDir 'quran.ar.warsh_muthamma.db'
$pagesJsonDir = Join-Path $dbDir 'pages_json'
$layoutJsonDir = Join-Path $dbDir 'page_layout_json'
$nodeHelper = Join-Path $PSScriptRoot 'sync_warsh_muthamma_ayahinfo_page.js'

if (-not (Test-Path -LiteralPath $sourceDb)) {
  throw "Source database was not found: $sourceDb"
}

Write-Info "Injecting page $page into the repository SQLite database..."
$jsonResult = & node "$nodeHelper" --page "$page" --db "$sourceDb" --pages-dir "$pagesJsonDir" --layout-dir "$layoutJsonDir"
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to inject the page into SQLite.'
}
Write-Ok $jsonResult

$windowsRoot = Resolve-WindowsQuranDataRoot
$windowsAyahInfoDir = Join-Path $windowsRoot 'databases\ayahinfo\warsh_muthamma'
New-Item -ItemType Directory -Path $windowsAyahInfoDir -Force | Out-Null
$windowsDb = Join-Path $windowsAyahInfoDir 'ayahinfo.db'
Copy-Item -LiteralPath $sourceDb -Destination $windowsDb -Force
Write-Ok "Windows ayahinfo.db was replaced: $windowsDb"

Invoke-AdbSync $sourceDb

Write-Host ''
Write-Ok 'Done. Run Hot Reload/Restart as needed, then reopen the page to see the edit.'
