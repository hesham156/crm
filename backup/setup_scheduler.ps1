# ============================================================
#  Setup Windows Task Scheduler for Daily Automatic Backup
#  Run this ONCE as Administrator to register the task
#
#  Schedule: Every day at 2:00 AM
#  Backup stored in: D:\saas\erp-backups\
# ============================================================

$taskName    = "ProSticker-ERP-DailyBackup"
$scriptPath  = "D:\saas\erp\backup\backup_local.ps1"
$logPath     = "D:\saas\erp-backups\backup.log"

# Ensure backup dir exists
New-Item -ItemType Directory -Path "D:\saas\erp-backups" -Force | Out-Null

$action  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NonInteractive -File `"$scriptPath`" >> `"$logPath`" 2>&1"

$trigger = New-ScheduledTaskTrigger -Daily -At "02:00AM"

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -DontStopIfGoingOnBatteries

# Remove old task if exists
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "  Removed existing task." -ForegroundColor DarkYellow
}

# Register new task (runs as current user)
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Description "Daily backup for ProSticker ERP (DB + media + config)" | Out-Null

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Scheduled Task Created Successfully!" -ForegroundColor Cyan
Write-Host "  Name     : $taskName" -ForegroundColor Cyan
Write-Host "  Schedule : Daily at 2:00 AM" -ForegroundColor Cyan
Write-Host "  Log      : $logPath" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To run now: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Green
Write-Host "  To remove : Unregister-ScheduledTask -TaskName '$taskName'" -ForegroundColor DarkYellow
Write-Host ""
