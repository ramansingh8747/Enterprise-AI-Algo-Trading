param (
    [switch]$NoBrowser,
    [switch]$Quiet
)

$ErrorActionPreference = 'Continue'

# Determine absolute project paths dynamically
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$LogsDir = Join-Path $ProjectRoot "logs"

if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$StartupLog = Join-Path $LogsDir "startup.log"
$BackendLog = Join-Path $LogsDir "backend.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logLine = "[$timestamp] [$Level] $Message"
    Add-Content -Path $StartupLog -Value $logLine -Encoding UTF8
    if (-not $Quiet) {
        switch ($Level) {
            "ERROR" { Write-Host $logLine -ForegroundColor Red }
            "WARN"  { Write-Host $logLine -ForegroundColor Yellow }
            "SUCCESS" { Write-Host $logLine -ForegroundColor Green }
            default { Write-Host $logLine -ForegroundColor Cyan }
        }
    }
}

Write-Log "======================================================"
Write-Log "Starting Enterprise AI Algo Trading Platform Services"
Write-Log "Project Root: $ProjectRoot"

# 1. Validate Python Virtual Environment
$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Log "Python virtual environment not found at: $PythonExe" "ERROR"
    exit 1
}

# 2. Check Database Service (PostgreSQL)
try {
    $pgService = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }
    if ($pgService) {
        Write-Log "PostgreSQL service is running ($($pgService.Name))." "INFO"
    } else {
        Write-Log "PostgreSQL service not detected running as a service. Backend will attempt local connection." "WARN"
    }
} catch {
    Write-Log "Could not verify PostgreSQL service: $_" "WARN"
}

# Helper to test TCP Port
function Test-PortActive {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conn)
    } catch {
        return $false
    }
}

# Helper to test HTTP endpoint
function Test-HttpEndpoint {
    param([string]$Url, [int]$TimeoutSec = 2)
    try {
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.Timeout = $TimeoutSec * 1000
        $req.Method = "GET"
        $resp = $req.GetResponse()
        $status = [int]$resp.StatusCode
        $resp.Close()
        return ($status -ge 200 -and $status -lt 400)
    } catch {
        return $false
    }
}

# 3. Backend Lifecycle
$BackendPort = 8000
$BackendHealthUrl = "http://127.0.0.1:8000/health"
$BackendRunning = Test-PortActive -Port $BackendPort

if ($BackendRunning -and (Test-HttpEndpoint -Url $BackendHealthUrl)) {
    Write-Log "Backend is already running on port $BackendPort and healthy." "INFO"
} else {
    Write-Log "Launching Backend (FastAPI via Uvicorn on port $BackendPort)..." "INFO"
    
    $backendCmd = "cmd.exe"
    $backendArgs = "/c `"$PythonExe`" -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort"
    
    Start-Process -FilePath $backendCmd -ArgumentList $backendArgs -WorkingDirectory $BackendDir `
        -RedirectStandardOutput $BackendLog -RedirectStandardError (Join-Path $LogsDir "backend_err.log") `
        -WindowStyle Hidden

    Write-Log "Waiting for Backend to become healthy at $BackendHealthUrl..." "INFO"
    $backendReady = $false
    $attempts = 0
    $maxAttempts = 30

    while (-not $backendReady -and $attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 1
        $attempts++
        if (Test-HttpEndpoint -Url $BackendHealthUrl) {
            $backendReady = $true
            break
        }
    }

    if ($backendReady) {
        Write-Log "Backend successfully started and healthy in $attempts second(s)!" "SUCCESS"
    } else {
        Write-Log "Backend failed to respond healthy within $maxAttempts seconds. Check $BackendLog for details." "ERROR"
    }
}

# 4. Frontend Lifecycle
$FrontendPort = 5173
$FrontendUrl = "http://localhost:5173"
$FrontendRunning = Test-PortActive -Port $FrontendPort

if ($FrontendRunning -and (Test-HttpEndpoint -Url $FrontendUrl)) {
    Write-Log "Frontend is already running on port $FrontendPort and reachable." "INFO"
} else {
    Write-Log "Launching Frontend (Vite on port $FrontendPort)..." "INFO"

    $npmCmd = "cmd.exe"
    $npmArgs = "/c npm run dev"
    
    Start-Process -FilePath $npmCmd -ArgumentList $npmArgs -WorkingDirectory $FrontendDir `
        -RedirectStandardOutput $FrontendLog -RedirectStandardError (Join-Path $LogsDir "frontend_err.log") `
        -WindowStyle Hidden

    Write-Log "Waiting for Frontend to become ready at $FrontendUrl..." "INFO"
    $frontendReady = $false
    $attempts = 0
    $maxAttempts = 30

    while (-not $frontendReady -and $attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 1
        $attempts++
        if (Test-HttpEndpoint -Url $FrontendUrl) {
            $frontendReady = $true
            break
        }
    }

    if ($frontendReady) {
        Write-Log "Frontend successfully started and reachable in $attempts second(s)!" "SUCCESS"
    } else {
        Write-Log "Frontend failed to respond within $maxAttempts seconds. Check $FrontendLog for details." "WARN"
    }
}

Write-Log "======================================================"
Write-Log "Application Status:"
Write-Log "  Frontend URL : $FrontendUrl" "SUCCESS"
Write-Log "  Backend URL  : http://localhost:$BackendPort" "SUCCESS"
Write-Log "  API Docs     : http://localhost:$BackendPort/docs" "SUCCESS"
Write-Log "  Health Check : $BackendHealthUrl" "SUCCESS"
Write-Log "======================================================"

# 5. Open Browser if requested
if (-not $NoBrowser) {
    try {
        Start-Process $FrontendUrl
        Write-Log "Launched default web browser at $FrontendUrl" "INFO"
    } catch {
        Write-Log "Could not open browser automatically: $_" "WARN"
    }
}

exit 0
