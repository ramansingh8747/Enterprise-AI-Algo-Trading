$ErrorActionPreference = 'Continue'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

function Test-HttpEndpoint {
    param([string]$Url, [int]$TimeoutSec = 2)
    try {
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.Timeout = $TimeoutSec * 1000
        $req.Method = "GET"
        $resp = $req.GetResponse()
        $status = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Close()
        $resp.Close()
        return @{
            IsHealthy = ($status -ge 200 -and $status -lt 400)
            StatusCode = $status
            Response = $body
        }
    } catch {
        return @{
            IsHealthy = $false
            StatusCode = 0
            Response = $_.Exception.Message
        }
    }
}

function Get-PortProcessInfo {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            $owningPid = $conns[0].OwningProcess
            $proc = Get-Process -Id $owningPid -ErrorAction SilentlyContinue
            return @{
                Listening = $true
                PID = $owningPid
                ProcessName = if ($proc) { $proc.ProcessName } else { "Unknown" }
                MemoryMB = if ($proc) { [math]::Round($proc.WorkingSet64 / 1MB, 2) } else { 0 }
            }
        }
    } catch {}
    return @{
        Listening = $false
        PID = 0
        ProcessName = ""
        MemoryMB = 0
    }
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Enterprise AI Algo Trading Platform - Service Status " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. PostgreSQL Service
Write-Host "`n[1] Database (PostgreSQL):" -ForegroundColor White
try {
    $pgServices = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue
    if ($pgServices) {
        foreach ($s in $pgServices) {
            $color = if ($s.Status -eq 'Running') { 'Green' } else { 'Red' }
            Write-Host "  Service: $($s.DisplayName) ($($s.Name)) -> $($s.Status)" -ForegroundColor $color
        }
    } else {
        Write-Host "  PostgreSQL Windows Service not found." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Could not query PostgreSQL service: $_" -ForegroundColor Red
}

# 2. Backend (FastAPI / Uvicorn)
Write-Host "`n[2] Backend API (Port 8000):" -ForegroundColor White
$backendPortInfo = Get-PortProcessInfo -Port 8000
if ($backendPortInfo.Listening) {
    Write-Host "  Process: $($backendPortInfo.ProcessName) (PID: $($backendPortInfo.PID), Memory: $($backendPortInfo.MemoryMB) MB)" -ForegroundColor Green
    $backendHealth = Test-HttpEndpoint -Url "http://127.0.0.1:8000/health"
    if ($backendHealth.IsHealthy) {
        Write-Host "  Health Endpoint : http://127.0.0.1:8000/health -> [OK 200]" -ForegroundColor Green
        Write-Host "  Health Data     : $($backendHealth.Response)" -ForegroundColor Gray
    } else {
        Write-Host "  Health Endpoint : http://127.0.0.1:8000/health -> [FAILED: $($backendHealth.Response)]" -ForegroundColor Red
    }
    Write-Host "  API Docs        : http://localhost:8000/docs" -ForegroundColor Cyan
} else {
    Write-Host "  Status: NOT RUNNING (Port 8000 is inactive)" -ForegroundColor Red
}

# 3. Frontend (Vite)
Write-Host "`n[3] Frontend UI (Port 5173):" -ForegroundColor White
$frontendPortInfo = Get-PortProcessInfo -Port 5173
if ($frontendPortInfo.Listening) {
    Write-Host "  Process: $($frontendPortInfo.ProcessName) (PID: $($frontendPortInfo.PID), Memory: $($frontendPortInfo.MemoryMB) MB)" -ForegroundColor Green
    $frontendHealth = Test-HttpEndpoint -Url "http://localhost:5173"
    if ($frontendHealth.IsHealthy) {
        Write-Host "  Frontend URL    : http://localhost:5173 -> [OK $($frontendHealth.StatusCode)]" -ForegroundColor Green
    } else {
        Write-Host "  Frontend URL    : http://localhost:5173 -> [FAILED: $($frontendHealth.Response)]" -ForegroundColor Red
    }
} else {
    Write-Host "  Status: NOT RUNNING (Port 5173 is inactive)" -ForegroundColor Red
}

# 4. Auto-Start Status
Write-Host "`n[4] Windows Auto-Start Configuration:" -ForegroundColor White
$startupLnk = Join-Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup" "EnterpriseAI-AlgoTrading.lnk"
if (Test-Path $startupLnk) {
    Write-Host "  Auto-Start is ENABLED (Shortcut present in Startup folder)" -ForegroundColor Green
    Write-Host "  Shortcut Location: $startupLnk" -ForegroundColor Gray
} else {
    Write-Host "  Auto-Start is DISABLED (No startup shortcut found)" -ForegroundColor Yellow
}

Write-Host "`n======================================================" -ForegroundColor Cyan
