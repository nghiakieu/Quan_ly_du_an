@echo off
chcp 65001 > nul
set PYTHONIOENCODING=utf-8

cd /d "c:\Users\KTTC CAU - NGHIA\Quan_ly_tien_do\quan_ly_tien_do_web_v2\backend"
echo [Migration] Dang chay script migrate_v2.py...
echo.

"c:\Users\KTTC CAU - NGHIA\Quan_ly_tien_do\.venv\Scripts\python.exe" scripts\migrate_v2.py

echo.
echo [Migration] Xong! Nhan phim bat ky de dong.
pause
