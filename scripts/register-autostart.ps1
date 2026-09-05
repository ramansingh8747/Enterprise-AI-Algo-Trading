$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path
$VbsLauncher = Join-Path $ScriptDir "run-background.vbs"
$StartupFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$ShortcutPath = Join-Path $StartupFolder "EnterpriseAI-AlgoTrading.lnk"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Registering Windows Auto-Start" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Target VBS Launcher: $VbsLauncher"
Write-Host "Startup Folder     : $StartupFolder"

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = "`"$VbsLauncher`""
    $Shortcut.WorkingDirectory = $ProjectRoot
    $Shortcut.Description = "Auto-start Enterprise AI Algo Trading Platform on Login"
    $Shortcut.Save()

    Write-Host "`n[SUCCESS] Windows Auto-Start has been registered successfully!" -ForegroundColor Green
    Write-Host "The application (Backend & Frontend) will now start automatically whenever you log into Windows." -ForegroundColor Green
    Write-Host "Shortcut created at: $ShortcutPath" -ForegroundColor Gray
} catch {
    Write-Host "`n[ERROR] Failed to create startup shortcut: $_" -ForegroundColor Red
    exit 1
}
