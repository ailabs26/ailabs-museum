: << 'CMDBLOCK'
@echo off
setlocal DisableDelayedExpansion
REM Cross-platform polyglot wrapper for extensionless hook scripts.
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" goto missing_name
set "HOOK_LAUNCHER=%~dp0run-hook.ps1"
if not exist "%HOOK_LAUNCHER%" goto missing_launcher

where pwsh.exe >nul 2>nul
if not errorlevel 1 goto run_pwsh
where powershell.exe >nul 2>nul
if not errorlevel 1 goto run_powershell

echo run-hook.cmd: PowerShell host not found >&2
exit /b 1

:run_pwsh
pwsh.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%HOOK_LAUNCHER%" %*
exit /b %errorlevel%

:run_powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%HOOK_LAUNCHER%" %*
exit /b %errorlevel%

:missing_name
echo run-hook.cmd: missing script name >&2
exit /b 1

:missing_launcher
echo run-hook.cmd: missing argv launcher >&2
exit /b 1
CMDBLOCK

# Unix: accept only an existing, extensionless basename in this directory.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="${1-}"
case "$SCRIPT_NAME" in
  ""|"."|".."|*/*|*\\*|*:*|*[!A-Za-z0-9_-]*)
    echo "run-hook.cmd: invalid script name" >&2
    exit 1
    ;;
esac
SCRIPT_PATH="${SCRIPT_DIR}/${SCRIPT_NAME}"
if [ ! -f "$SCRIPT_PATH" ] || [ -L "$SCRIPT_PATH" ]; then
  echo "run-hook.cmd: hook not found or unsafe" >&2
  exit 1
fi
shift
exec bash "$SCRIPT_PATH" "$@"

