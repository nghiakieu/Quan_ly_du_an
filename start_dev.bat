@echo off
echo ===================================================
echo   KHOI DONG HE THONG QUAN LY TIEN DO (DEV MODE)
echo ===================================================

echo [1/2] Dang khoi dong Backend API (Port 8000)...
start "Backend API Server" cmd /k "call .venv\Scripts\activate && cd quan_ly_tien_do_web\backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Dang khoi dong Frontend Web (Port 3000)...
start "Frontend Web App" cmd /k "cd quan_ly_tien_do_web\frontend && npm run dev -- -H 0.0.0.0"

echo.
echo ===================================================
echo   HE THONG DA DUOC KHOI DONG!
echo   - Backend: http://localhost:8000/docs
echo   - Frontend: http://localhost:3000
echo ===================================================
timeout /t 5 >nul
start http://localhost:3000
