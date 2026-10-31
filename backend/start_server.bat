@echo off
title AI Video Summary Server (FastAPI : 8765)
cd /d "%~dp0"

echo ========================================================
echo      AI Video Summary Server - Starting (Port 8765)
echo ========================================================
echo  Server Address: http://127.0.0.1:8765
echo  Status: Running in background for Chrome Extension
echo ========================================================
echo.

set PY_BIN=
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set PY_BIN="%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if "%PY_BIN%"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set PY_BIN="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if "%PY_BIN%"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set PY_BIN="%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if "%PY_BIN%"=="" set PY_BIN=py
if "%PY_BIN%"=="" set PY_BIN=python

echo [OK] Using Python: %PY_BIN%
echo [OK] Starting FastAPI backend on 127.0.0.1:8765...
echo.

%PY_BIN% -m uvicorn main:app --host 127.0.0.1 --port 8765
pause