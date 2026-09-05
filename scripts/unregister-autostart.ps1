$ErrorActionPreference = 'Continue'

$StartupFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$ShortcutPath = Join-Path $StartupFolder "EnterpriseAI-AlgoTrading.lnk"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Unregistering Windows Auto-Start" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

if (Test-Path $ShortcutPath) {
    try {
        Remove-Item -Path $ShortcutPath -Force
        Write-Host "`n[SUCCESS] Windows Auto-Start shortcut removed successfully!" -ForegroundColor Green
        Write-Host "The application will no longer start automatically on Windows login." -ForegroundColor Yellow
    } catch {
        Write-Host "`n[ERROR] Failed to remove shortcut: $_" -ForegroundColor Red
    }
} else {
    Write-Host "`n[INFO] Auto-Start shortcut was not found in Startup folder. Nothing to remove." -ForegroundColor Gray
}
