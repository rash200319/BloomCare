@echo off
echo Starting BloomCare Application...
echo.

echo [1/3] Installing Python dependencies...
pip install -r api_requirements.txt

echo.
echo [2/3] Starting FastAPI Backend (http://localhost:8000)...
start cmd /k "python api.py"

echo.
echo [3/3] Starting Next.js Frontend (http://localhost:3000)...
cd frontend
npm install
npm run dev

echo.
echo Both servers should be running now!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
pause
