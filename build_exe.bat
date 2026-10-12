@echo off
setlocal
cd /d "%~dp0"

echo Building PMS.exe...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0native\build.ps1"
if errorlevel 1 (
  echo.
  echo Native build failed. Falling back to PMS.bat launcher.
  exit /b 1
)

echo.
echo Also ensuring Python deps for the launcher...
python -m pip install -q flask
echo Done.
endlocal
