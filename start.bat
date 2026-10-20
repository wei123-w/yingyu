@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where.exe py >nul 2>nul
if not errorlevel 1 goto use_py
where.exe python >nul 2>nul
if not errorlevel 1 goto use_python
echo 未找到 Python。请安装 Python 3 并加入 PATH，然后重新运行本脚本。
pause
exit /b 1

:use_py
start "英语 VS 本地服务" cmd /k "py -3 server.py"
goto open_page

:use_python
start "英语 VS 本地服务" cmd /k "python server.py"

:open_page
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8765
echo 网页已在浏览器中打开。请保持“英语 VS 本地服务”窗口开启。
pause
endlocal
