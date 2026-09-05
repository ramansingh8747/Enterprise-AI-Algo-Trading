# Strategy File Upload Fix — Step 34.192

This patch addresses the strategy import upload flow for PDF, DOCX, TXT and XLSX.

## Important
The frontend upload flow already uses `FormData`. The main backend failure observed for PDF imports is a missing parser dependency (`pypdf`). DOCX/XLSX imports similarly require `python-docx` and `openpyxl`.

### Install dependencies
From the project root in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-strategy-import.ps1
```

Or manually:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install "pypdf>=5,<7" "python-docx>=1.1,<2" "openpyxl>=3.1,<4" "python-multipart>=0.0.20,<1"
```

Then start the backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The patch files should be copied over the matching paths in the existing project.
