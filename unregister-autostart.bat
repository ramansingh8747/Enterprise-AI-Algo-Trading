@echo off
setlocal
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\unregister-autostart.ps1"
echo.
pause
endlocal
