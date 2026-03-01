# auto-backup.ps1
# Default: no automatic commits without explicit opt-in.
# Opt-in options:
#   1) create file ".auto_backup_enabled" in project root, or
#   2) set environment variable AUTO_BACKUP_ENABLE=1.
# Manual one-off:
#   .\auto-backup.ps1 -Force

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$VerboseOutput
)

$projectPath = "C:\Users\gunda\Desktop\Rohre-3D-erster-stand"
$markerFile = Join-Path $projectPath ".last_auto_backup"
$optInFile = Join-Path $projectPath ".auto_backup_enabled"
$gitDir = Join-Path $projectPath ".git"

function Write-BackupInfo([string]$message, [ConsoleColor]$color = [ConsoleColor]::DarkGray) {
    if ($VerboseOutput) {
        Write-Host $message -ForegroundColor $color
    }
}

if (-not (Test-Path $projectPath) -or -not (Test-Path $gitDir)) {
    Write-BackupInfo "[Auto-Backup] Project path or .git missing. Skip."
    return
}

$optInEnabled = (Test-Path $optInFile) -or ($env:AUTO_BACKUP_ENABLE -eq "1")
if (-not $Force -and -not $optInEnabled) {
    Write-BackupInfo "[Auto-Backup] Disabled (no opt-in)."
    return
}

# Skip while git operation is in progress (merge/rebase/cherry-pick/bisect)
if ((Test-Path (Join-Path $gitDir "MERGE_HEAD")) -or
    (Test-Path (Join-Path $gitDir "REBASE_HEAD")) -or
    (Test-Path (Join-Path $gitDir "CHERRY_PICK_HEAD")) -or
    (Test-Path (Join-Path $gitDir "BISECT_LOG"))) {
    Write-BackupInfo "[Auto-Backup] Git operation detected. Skip."
    return
}

$today = Get-Date -Format "yyyy-MM-dd"
$lastBackup = if (Test-Path $markerFile) {
    Get-Content $markerFile -ErrorAction SilentlyContinue | Select-Object -First 1
} else {
    ""
}

if ($lastBackup -eq $today -and -not $Force) {
    Write-BackupInfo "[Auto-Backup] Already processed today."
    return
}

Push-Location $projectPath
try {
    $status = git.exe status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-BackupInfo "[Auto-Backup] No changes."
        Set-Content -Path $markerFile -Value $today -NoNewline
        return
    }

    Write-Host "[Auto-Backup] Creating git backup..." -ForegroundColor Cyan
    git.exe add -A | Out-Null
    $staged = git.exe diff --cached --name-only
    if ([string]::IsNullOrWhiteSpace($staged)) {
        Write-BackupInfo "[Auto-Backup] No staged changes after add -A."
        Set-Content -Path $markerFile -Value $today -NoNewline
        return
    }

    git.exe commit -m "auto: Tages-Backup $today" | Out-Null
    Set-Content -Path $markerFile -Value $today -NoNewline
    Write-Host "[Auto-Backup] Done." -ForegroundColor Green
}
finally {
    Pop-Location
}
