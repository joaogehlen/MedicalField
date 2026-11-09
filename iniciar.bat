@echo off
chcp 65001 >nul
title MedicalField
echo.
echo  MedicalField - iniciando pelo Ubuntu (WSL)...
echo  Se pedir senha, e a senha do seu usuario do Ubuntu.
echo.
wsl --cd "%~dp0." -- bash -c "sudo MF_BUILD=${MF_BUILD:-1} infra/scripts/start-all.sh && echo && echo '  Deixe esta janela ABERTA enquanto usa o sistema.' && read -p '  Pressione Enter para PARAR o MedicalField... ' _ && sudo infra/scripts/stop-all.sh"
if errorlevel 1 (
  echo.
  echo  Algo falhou. Se aparecer "wsl nao e reconhecido", instale o WSL ^(COMO-RODAR.md, passo 1^).
  echo  Se um servico falhou, copie o bloco com o X e mande para o Claude.
)
echo.
pause
