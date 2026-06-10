@echo off
set "PAGEARG=%~1"
if "%PAGEARG%"=="" goto skip_trim
if "%PAGEARG:~0,1%"=="-" set "PAGEARG=%PAGEARG:~1%"
:skip_trim
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_warsh_muthamma_ayahinfo.ps1" -Page "%PAGEARG%"

