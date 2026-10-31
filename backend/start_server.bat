@echo off
title AI视频总结本地调度服务 (FastAPI : 8765)
cd /d "%~dp0"
echo ========================================================
echo        AI视频总结与思维导图 - 本地调度服务正在启动
echo ========================================================
echo 端口: http://127.0.0.1:8765
echo 请保持此窗口打开，以供浏览器插件调用。
echo --------------------------------------------------------

python -m uvicorn main:app --host 127.0.0.1 --port 8765
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] Python 未找到或运行出错，请确保已安装 Python 并已将其添加到系统环境变量 PATH 中。
    pause
)
pause
