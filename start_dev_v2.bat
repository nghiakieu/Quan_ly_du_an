@echo off
chcp 65001 > nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"

echo ===================================================
echo   KHOI DONG HE THONG QUAN LY TIEN DO V2
echo ===================================================

:: 1. Tat cac tien trinh dang dung port 8000, 3000, 3001
echo [Step 1/4] Dang tat cac tien trinh cu (8000, 3000, 3001)...
powershell -Command "Get-NetTCPConnection -LocalPort 8000,3000,3001 -ErrorAction SilentlyContinue | ForEach-Object { $p = $_.OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }"

:: 2. Don dep cache Frontend (tuy chon)
echo [Step 2/4] Don dep cache Next.js...
if exist "quan_ly_tien_do_web_v2\frontend\.next" (
    rmdir /s /q "quan_ly_tien_do_web_v2\frontend\.next"
    echo   Da xoa thu muc .next
) else (
    echo   Khong co cache
)

:: 3. Khoi dong Backend
echo [Step 3/4] Khoi dong Backend API (port 8000)...
set BACKEND_STARTED=0
if exist ".venv\Scripts\python.exe" (
    start "Backend API 8000" cmd /c "cd /d %~dp0quan_ly_tien_do_web_v2\backend && %~dp0.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 && pause"
    goto :backend_ok
)
if exist "quan_ly_tien_do_web_v2\backend\.venv\Scripts\python.exe" (
    start "Backend API 8000" cmd /c "cd /d %~dp0quan_ly_tien_do_web_v2\backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 && pause"
    goto :backend_ok
)
:: Thu python system
start "Backend API 8000" cmd /c "cd /d %~dp0quan_ly_tien_do_web_v2\backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 && pause"
:backend_ok

:: 4. Khoi dong Frontend
echo [Step 4/4] Khoi dong Frontend Web (port 3000)...
start "Frontend Web" cmd /c "cd /d %~dp0quan_ly_tien_do_web_v2\frontend && npm run dev && pause"

echo.
echo ===================================================
echo   HE THONG DA KHOI DONG!
echo   - Backend:  http://127.0.0.1:8000
echo   - Frontend: http://localhost:3000
echo ===================================================
echo.
echo Dang cho Backend san sang (15 giay)...
timeout /t 15 > nul
echo Mo trinh duyet...
start http://localhost:3000
echo.
echo Hoan tat. Bam phim bat ky de dong...
pause > nul
