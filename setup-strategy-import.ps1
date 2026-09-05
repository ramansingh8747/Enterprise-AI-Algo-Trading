$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\backend"
if (-not (Test-Path ".venv\Scripts\python.exe")) {
  Write-Host "Backend .venv not found. Create it first with: python -m venv .venv" -ForegroundColor Yellow
  exit 1
}
$py = ".venv\Scripts\python.exe"
& $py -m pip install --upgrade pip
& $py -m pip install "pypdf>=5,<7" "python-docx>=1.1,<2" "openpyxl>=3.1,<4" "python-multipart>=0.0.20,<1"
Write-Host "Strategy import dependencies installed." -ForegroundColor Green
Write-Host "Start backend with: .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000" -ForegroundColor Cyan
