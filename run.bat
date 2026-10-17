@echo off
cls

:: Sab kuch chupane ke liye 'cls' use kiya hai

echo [Status] Installing npm dependencies...
call npm i >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    cls
    echo [Error] Failed to install dependencies.
    pause
    exit /b 1
)

cls
echo [Status] Running AutoCaptcha.py...
python AutoCaptcha.py >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [Warning] share.py failed (continuing anyway)
)

cls
echo [Status] Starting Tool...
call npm start
IF %ERRORLEVEL% NEQ 0 (
    cls
    echo [Error] Failed to start the tool.
    pause
    exit /b 1
)