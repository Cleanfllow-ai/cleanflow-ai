@echo off
REM Usage: switch-env.cmd <environment>
REM Example: switch-env.cmd kiran
REM          switch-env.cmd asfar

if "%1"=="" (
    echo Usage: switch-env.cmd ^<environment^>
    echo Available: dev, prod
    exit /b 1
)

set "ENV_FILE=.env.%1"

if not exist "%ENV_FILE%" (
    echo Error: %ENV_FILE% not found
    exit /b 1
)

copy /Y "%ENV_FILE%" .env.local >nul
echo Switched to '%1' environment (.env.local updated)
echo Restart the dev server for changes to take effect.
