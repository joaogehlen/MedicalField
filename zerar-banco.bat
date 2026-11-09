@echo off
chcp 65001 >nul
title MedicalField - zerar banco
echo.
echo  Apaga todos os dados e volta aos dados de demonstracao (para ensaiar o roteiro).
echo.
wsl --cd "%~dp0." -- sudo infra/scripts/reset-db.sh
echo.
pause
