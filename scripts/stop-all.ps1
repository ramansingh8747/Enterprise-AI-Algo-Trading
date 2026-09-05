$ErrorActionPreference = 'Continue'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path
$LogsDir = Join-Path $ProjectRoot "logs"

function Stop-ProcessByPort {
    param([int]$Port, [string]$ServiceName)
    Write-Host "Checking for $ServiceName on port $Port..." -ForegroundColor Cyan
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -gt 0) {
                    try {
                        $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
                        if ($proc) {
                            Write-Host "Stopping $ServiceName (PID: $pidToKill - $($proc.ProcessName))..." -ForegroundColor Yellow
                            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                            Write-Host "$ServiceName (PID: $($pidToKill)) stopped successfully." -ForegroundColor Green
                        }
                    } catch {
                        Write-Host "Error stopping PID $($pidToKill): $_" -ForegroundColor Red
                    }
                }
            }
        } else {
            Write-Host "No active listener found for $ServiceName on port $Port." -ForegroundColor Gray
        }
    } catch {
        Write-Host "Error querying port $($Port): $_" -ForegroundColor Red
    }
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Stopping Enterprise AI Algo Trading Platform Services" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Stop Backend on Port 8000
Stop-ProcessByPort -Port 8000 -ServiceName "Backend (FastAPI/Uvicorn)"

# Stop Frontend on Port 5173
Stop-ProcessByPort -Port 5173 -ServiceName "Frontend (Vite)"

# Also clean up any lingering node or python spawned specifically from this project path if needed
Start-Sleep -Seconds 1

Write-Host "`nAll application services stopped." -ForegroundColor Green
