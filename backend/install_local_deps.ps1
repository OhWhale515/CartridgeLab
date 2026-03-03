param(
    [ValidateSet("core", "full")]
    [string]$Mode = "full"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vendorDir = Join-Path $scriptDir ".vendor"
$tempDir = Join-Path $scriptDir ".tmp"
$cacheDir = Join-Path $scriptDir "pip-cache"

New-Item -ItemType Directory -Force $vendorDir | Out-Null
New-Item -ItemType Directory -Force $tempDir | Out-Null
New-Item -ItemType Directory -Force $cacheDir | Out-Null

$env:TEMP = $tempDir
$env:TMP = $tempDir
$env:PIP_CACHE_DIR = $cacheDir
$env:PYTHONDONTWRITEBYTECODE = "1"

if ($Mode -eq "core") {
    python -m pip install --no-cache-dir --target $vendorDir flask flask-cors
} else {
    python -m pip install --no-cache-dir --target $vendorDir -r (Join-Path $scriptDir "requirements.txt")
}
