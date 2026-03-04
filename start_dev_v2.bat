@echo off
echo ===================================================
echo   KHOI DONG HE THONG QUAN LY TIEN DO V2 (DEV MODE)
echo ===================================================

echo [1/2] Dang khoi dong Backend API (Port 8002)...
start "Backend API Server V2" cmd /k "call .venv\Scripts\activate && cd quan_ly_tien_do_web_v2\backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8002"

echo [2/2] Dang khoi dong Frontend Web (Port 3002)...
start "Frontend Web App V2" cmd /k "cd quan_ly_tien_do_web_v2\frontend && npm run dev -- -p 3002 -H 0.0.0.0"

echo.
echo ===================================================
echo   HE THONG V2 DA DUOC KHOI DONG!
echo   - Backend: http://localhost:8002/docs
echo   - Frontend: http://localhost:3002
echo ===================================================
timeout /t 5 >nul
start http://localhost:3002
