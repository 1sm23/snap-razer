$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$captureDir = Join-Path $workspace "logs\usbpcap-button-assignment"
$usbpcap = "C:\Program Files\USBPcap\USBPcapCMD.exe"
$pidFile = Join-Path $captureDir "capture-pids.json"

if (-not (Test-Path $usbpcap)) {
  throw "USBPcapCMD.exe not found at $usbpcap"
}

New-Item -ItemType Directory -Force -Path $captureDir | Out-Null

if (Test-Path $pidFile) {
  throw "Capture pid file already exists. Run scripts\stop-usbpcap-capture.ps1 first."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$captures = @()

foreach ($index in 1..8) {
  $device = "\\.\USBPcap$index"
  $file = Join-Path $captureDir "usbpcap$index-$timestamp.pcapng"
  $stdout = Join-Path $captureDir "usbpcap$index-$timestamp.out.txt"
  $stderr = Join-Path $captureDir "usbpcap$index-$timestamp.err.txt"
  $arguments = @("-d", $device, "-A", "--inject-descriptors", "-o", $file)
  $process = Start-Process `
    -FilePath $usbpcap `
    -ArgumentList $arguments `
    -PassThru `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden

  $captures += [pscustomobject]@{
    index = $index
    device = $device
    file = $file
    pid = $process.Id
    stdout = $stdout
    stderr = $stderr
  }
}

$captures | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 -Path $pidFile

Write-Host "USBPcap capture started."
Write-Host "Now change one Razer button assignment in Synapse, wait 2 seconds, then run:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\stop-usbpcap-capture.ps1`""
