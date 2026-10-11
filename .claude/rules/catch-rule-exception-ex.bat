@echo off
chcp 65001 > nul
powershell -ExecutionPolicy Bypass -File "%~dp0catch-rule-exception-ex.ps1" %*
pause
