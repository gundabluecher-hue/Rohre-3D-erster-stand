# backup.ps1 — Sichert alle JS-Quelldateien vor einer Aenderungssession
# Aufruf: powershell -File backup.ps1
# Wiederherstellen einer Datei: Copy-Item js/modules/Arena.js.bak js/modules/Arena.js

$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$files = @(
    "js/modules/Arena.js",
    "js/modules/Bot.js",
    "js/modules/EntityManager.js",
    "js/modules/Trail.js",
    "js/modules/Player.js",
    "js/modules/Config.js",
    "js/main.js"
)

$backupDir = "backups/$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

foreach ($file in $files) {
    if (Test-Path $file) {
        $dest = "$backupDir/" + ($file -replace "/", "_")
        Copy-Item $file $dest
        Write-Host "Gesichert: $file -> $dest"
    }
}

Write-Host ""
Write-Host "Backup abgeschlossen: $backupDir"
Write-Host "Wiederherstellen: Copy-Item '$backupDir/js_modules_Arena.js' js/modules/Arena.js"
