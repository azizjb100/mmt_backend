# db-tunnel.ps1
# SSH tunnel untuk akses database MySQL di server 103.150.117.18 dari PC luar.
#
#   127.0.0.1:3308 (lokal)  --SSH-->  127.0.0.1:3306 (di server)
#
# Port 3306 server diblokir firewall dari luar; jalur yang terbuka hanya
# SSH (22) dengan key C:\DATA\Kencana\zainal.ppk (user zainal).
#
# Jalankan:  powershell -ExecutionPolicy Bypass -File .\db-tunnel.ps1
# Biarkan jendela ini terbuka selama backend .env memakai DB_HOST=127.0.0.1, DB_PORT=3308.
# Shortcut Windows: buat .lnk yang menarget perintah di atas (agar auto-start).

$plink = "C:\Program Files\HeidiSQL\plink.exe"
if (-not (Test-Path $plink)) { $plink = "C:\Program Files (x86)\PuTTY\plink.exe" }
$key    = "C:\DATA\Kencana\zainal.ppk"
$sshUser = "zainal"
$sshHost = "103.150.117.18"
$localPort = 3308

if (-not (Test-Path $key)) {
  Write-Host "Private key tidak ditemukan: $key" -ForegroundColor Red
  Read-Host "Tekan Enter untuk keluar"
  exit 1
}

Write-Host "Memulai SSH tunnel DB: lokal $localPort -> ${sshHost}:3306 (auto-reconnect)" -ForegroundColor Cyan
while ($true) {
  & $plink -batch -N -ssh -i $key -L "${localPort}:127.0.0.1:3306" "${sshUser}@${sshHost}"
  Write-Host "Tunnel terputus, reconnect dalam 3 detik..." -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}
