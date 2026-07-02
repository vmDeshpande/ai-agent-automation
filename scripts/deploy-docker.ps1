param(
  [switch]$Proxy
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$infra = Join-Path $root 'infra'
Set-Location $infra

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Created infra/.env from infra/.env.example'
}

if ($Proxy) {
  docker compose --profile proxy up -d --build
} else {
  docker compose up -d --build
}
