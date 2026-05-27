$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$captureDir = Join-Path $workspace "logs\usbpcap-button-assignment"
$pidFile = Join-Path $captureDir "capture-pids.json"

if (-not (Test-Path $pidFile)) {
  throw "No active capture pid file found at $pidFile"
}

$captures = Get-Content -Raw -Path $pidFile | ConvertFrom-Json

foreach ($capture in $captures) {
  $process = Get-Process -Id $capture.pid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $capture.pid -Force
  }
}

Start-Sleep -Milliseconds 500
Remove-Item -LiteralPath $pidFile -Force

$captures |
  ForEach-Object {
    $file = $_.file
    [pscustomobject]@{
      index = $_.index
      file = $file
      bytes = if (Test-Path $file) { (Get-Item $file).Length } else { 0 }
      stdout = $_.stdout
      stderr = $_.stderr
    }
  } |
  Sort-Object bytes -Descending |
  Format-Table -AutoSize

Write-Host "USBPcap capture stopped."
