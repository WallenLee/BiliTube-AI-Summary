@echo off
chcp 65001 >nul
title AI视频总结本地调度服务 (FastAPI : 8765)
cd /d "%~dp0"

echo ========================================================
echo        AI视频总结与思维导图 - 本地调度服务正在启动
echo ========================================================
echo 端口: http://127.0.0.1:8765
echo 请保持此窗口打开，以供浏览器插件调用。
echo --------------------------------------------------------

set PY_BIN=
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set PY_BIN="%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if "%PY_BIN%"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set PY_BIN="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if "%PY_BIN%"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set PY_BIN="%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if "%PY_BIN%"=="" if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" set PY_BIN="%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
if "%PY_BIN%"=="" set PY_BIN=py

echo 正在使用 Python 启动服务: %PY_BIN%
%PY_BIN% -m uvicorn main:app --host 127.0.0.1 --port 8765
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo 尝试使用备用命令 python 启动...
    python -m uvicorn main:app --host 127.0.0.1 --port 8765
)
pause
