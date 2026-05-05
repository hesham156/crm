# ============================================================
#  ProSticker ERP - Local Backup Script (PowerShell)
#  Backs up: SQLite DB, media files, .env files, credentials
#  Run from anywhere, saves to D:\saas\erp-backups\
#
#  Usage:
#    .\backup_local.ps1
#    .\backup_local.ps1 -BackupRoot "E:\my-backups" -KeepDays 14
# ============================================================

param(
    [string]$BackupRoot = "D:\saas\erp-backups",
    [int]$KeepDays = 30
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = Join-Path $BackupRoot $timestamp

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ProSticker ERP Backup - $timestamp" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Create backup directory
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "[+] Backup directory: $backupDir" -ForegroundColor Green

# ── 1. SQLite Database ──────────────────────────────────────
Write-Host "`n[1/4] Backing up SQLite database..." -ForegroundColor Yellow
$sqliteSrc  = "D:\saas\erp\backend\db.sqlite3"
$sqliteDest = Join-Path $backupDir "db.sqlite3"
if (Test-Path $sqliteSrc) {
    Copy-Item -Path $sqliteSrc -Destination $sqliteDest
    $size = [math]::Round((Get-Item $sqliteDest).Length / 1KB, 1)
    Write-Host "    OK  db.sqlite3 ($size KB)" -ForegroundColor Green
} else {
    Write-Host "    SKIP  db.sqlite3 not found (using PostgreSQL in production)" -ForegroundColor DarkYellow
}

# ── 2. Media Files ──────────────────────────────────────────
Write-Host "`n[2/4] Backing up media files..." -ForegroundColor Yellow
$mediaSrc  = "D:\saas\erp\backend\media"
$mediaDest = Join-Path $backupDir "media"
if (Test-Path $mediaSrc) {
    Copy-Item -Path $mediaSrc -Destination $mediaDest -Recurse
    $fileCount = (Get-ChildItem $mediaDest -Recurse -File).Count
    Write-Host "    OK  media/ ($fileCount files)" -ForegroundColor Green
} else {
    Write-Host "    SKIP  media/ directory not found" -ForegroundColor DarkYellow
}

# ── 3. Designs Folder ───────────────────────────────────────
Write-Host "`n[3/4] Backing up designs folder..." -ForegroundColor Yellow
$designsSrc  = "D:\saas\erp\backend\designs"
$designsDest = Join-Path $backupDir "designs"
if (Test-Path $designsSrc) {
    Copy-Item -Path $designsSrc -Destination $designsDest -Recurse
    $fileCount = (Get-ChildItem $designsDest -Recurse -File).Count
    Write-Host "    OK  designs/ ($fileCount files)" -ForegroundColor Green
} else {
    Write-Host "    SKIP  designs/ directory not found" -ForegroundColor DarkYellow
}

# ── 4. Config & Secrets ─────────────────────────────────────
Write-Host "`n[4/4] Backing up config & secrets..." -ForegroundColor Yellow
$configDir = Join-Path $backupDir "config"
New-Item -ItemType Directory -Path $configDir -Force | Out-Null

$filesToBackup = @(
    @{ Src = "D:\saas\erp\.env";                    Name = "root.env" },
    @{ Src = "D:\saas\erp\backend\.env";             Name = "backend.env" },
    @{ Src = "D:\saas\erp\backend\credentials.json"; Name = "credentials.json" },
    @{ Src = "D:\saas\erp\docker-compose.yml";       Name = "docker-compose.yml" },
    @{ Src = "D:\saas\erp\nginx\nginx.conf";         Name = "nginx.conf" }
)

foreach ($f in $filesToBackup) {
    if (Test-Path $f.Src) {
        Copy-Item -Path $f.Src -Destination (Join-Path $configDir $f.Name)
        Write-Host "    OK  $($f.Name)" -ForegroundColor Green
    } else {
        Write-Host "    SKIP  $($f.Name) not found" -ForegroundColor DarkYellow
    }
}

# ── Compress to ZIP ─────────────────────────────────────────
Write-Host "`nCompressing backup..." -ForegroundColor Yellow
$zipPath = Join-Path $BackupRoot "backup_$timestamp.zip"
Compress-Archive -Path "$backupDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Path $backupDir -Recurse -Force
$zipSizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "    OK  backup_$timestamp.zip ($zipSizeMB MB)" -ForegroundColor Green

# ── Cleanup Old Backups ─────────────────────────────────────
Write-Host "`nCleaning old backups (older than $KeepDays days)..." -ForegroundColor Yellow
$cutoff = (Get-Date).AddDays(-$KeepDays)
$old = Get-ChildItem -Path $BackupRoot -Filter "backup_*.zip" |
       Where-Object { $_.LastWriteTime -lt $cutoff }
foreach ($f in $old) {
    Remove-Item $f.FullName -Force
    Write-Host "    Deleted: $($f.Name)" -ForegroundColor DarkYellow
}
if ($old.Count -eq 0) { Write-Host "    Nothing to clean." -ForegroundColor DarkGray }

# ── Summary ─────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Backup Complete!" -ForegroundColor Cyan
Write-Host "  Location : $zipPath" -ForegroundColor Cyan
Write-Host "  Size     : $zipSizeMB MB" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
