@echo off
rem Igual ao iniciar.bat, mas sem recompilar (use depois da primeira vez).
set MF_BUILD=0
set WSLENV=MF_BUILD
call "%~dp0iniciar.bat"
