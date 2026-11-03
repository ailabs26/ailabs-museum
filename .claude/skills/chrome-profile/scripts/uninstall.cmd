@echo off
REM uninstall.cmd -- remove the chrome-profile shim and (optionally) the user
REM config on Windows. Mirrors uninstall.sh.
REM
REM What this removes:
REM   - %PREFIX%\bin\chrome-profile.cmd (the shim install.cmd wrote)
REM   - %USERPROFILE%\.config\chrome-profile (only with /purge)
REM
REM What this does NOT remove:
REM   - The skill files themselves under %USERPROFILE%\.agents\skills\.
REM     Use `npx skills remove chrome-profile` for that.
REM   - Chrome data, cookies, or any profile.
REM
REM Usage:
REM   uninstall.cmd            remove shim only (config preserved)
REM   uninstall.cmd /purge     also delete profiles.json under %APPDATA%

setlocal

if "%PREFIX%"=="" set "PREFIX=%USERPROFILE%\.local"
set "BIN_DIR=%PREFIX%\bin"
set "SHIM=%BIN_DIR%\chrome-profile.cmd"

set "PURGE=0"
if /I "%~1"=="/purge" set "PURGE=1"
if /I "%~1"=="--purge" set "PURGE=1"
if /I "%~1"=="-p" set "PURGE=1"

if exist "%SHIM%\" (
  goto :invalid_shim
) else if exist "%SHIM%" (
  del /F /Q "%SHIM%" >nul 2>&1
  if errorlevel 1 goto :remove_failed
  if exist "%SHIM%" goto :remove_failed
  echo [+] removed shim: %SHIM%
) else (
  echo [=] no shim at %SHIM% ^(already removed?^)
)

REM Python's XDG fallback on Windows is %APPDATA% via Path.home()/.config; the
REM CLI uses ~/.config too, but on Windows that resolves to %USERPROFILE%\.config.
set "CFG_DIR=%USERPROFILE%\.config\chrome-profile"
if "%PURGE%"=="1" (
  if exist "%CFG_DIR%" (
    rmdir /S /Q "%CFG_DIR%" >nul 2>&1
    if errorlevel 1 goto :purge_failed
    if exist "%CFG_DIR%" goto :purge_failed
    echo [+] purged config: %CFG_DIR%
  ) else (
    echo [=] no config dir at %CFG_DIR%
  )
) else (
  if exist "%CFG_DIR%" echo [*] preserved config: %CFG_DIR%  ^(use /purge to remove^)
)

echo.
echo [*] To also remove the skill files, run:
echo     npx skills remove chrome-profile
endlocal & exit /b 0

:invalid_shim
echo uninstall.cmd: shim path is a directory: %SHIM%
endlocal & exit /b 1

:remove_failed
echo uninstall.cmd: cannot remove %SHIM%; close processes using it and retry.
endlocal & exit /b 1

:purge_failed
echo uninstall.cmd: cannot purge %CFG_DIR%
endlocal & exit /b 1
