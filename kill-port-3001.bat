@echo off
setlocal enabledelayedexpansion

set "PORT_TO_KILL=3001"
set "PID_FOUND="

echo Searching for process using TCP port %PORT_TO_KILL%...

for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr /R /C:"TCP.*:%PORT_TO_KILL% .*LISTENING"') do (
    set "PID_FOUND=%%a"
    goto :found_pid
)

:found_pid
if defined PID_FOUND (
    echo Found process with PID: %PID_FOUND% using port %PORT_TO_KILL%.
    echo Terminating process...
    taskkill /PID %PID_FOUND% /F
    if !errorlevel! equ 0 (
        echo Process %PID_FOUND% terminated successfully.
    ) else (
        echo Failed to terminate process %PID_FOUND%. It might require administrator privileges or may have already exited.
    )
) else (
    echo No process found listening on TCP port %PORT_TO_KILL%.
)

endlocal
echo.
pause
