@echo off
title BloomCare Backend
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        BloomCare Backend Startup         ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Check virtual environment ────────────────────────────────────────────────
if not exist ".venv" (
    echo  [1/3] Creating virtual environment...
    py -m venv .venv
)

:: ── Activate venv ─────────────────────────────────────────────────────────────
echo  [1/3] Activating virtual environment...
call .venv\Scripts\activate.bat

:: ── Install dependencies ──────────────────────────────────────────────────────
echo  [2/3] Installing dependencies...
pip install -r requirements.txt --quiet

:: ── Start server ──────────────────────────────────────────────────────────────
echo  [3/3] Starting BloomCare API on http://127.0.0.1:8000
echo  Docs available at: http://127.0.0.1:8000/docs
echo.
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause
