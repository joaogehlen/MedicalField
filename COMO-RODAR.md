# Como rodar o MedicalField no seu computador (Windows)

O MedicalField usa PostgreSQL, Nginx, Java, Node e Python, e os scripts são para Linux. No Windows, o caminho mais simples é o **WSL** (o Linux que vem dentro do Windows). O projeto fica numa pasta da **Área de Trabalho**, que você abre normalmente pelo Explorador de Arquivos e pelo VS Code. Os comandos rodam no terminal do Ubuntu.

> Leva uns 20 minutos na primeira vez (a maior parte é download). Depois, subir o sistema é **um comando**.

---

## 1. Instalar o WSL (uma vez)

1. Abra o **PowerShell como administrador** (menu Iniciar → digite *PowerShell* → botão direito → *Executar como administrador*).
2. Rode:
   ```powershell
   wsl --install -d Ubuntu-24.04
   ```
3. **Reinicie o computador** quando pedir.
4. Depois de reiniciar, o **Ubuntu** abre sozinho (ou procure *Ubuntu* no menu Iniciar). Crie um usuário e uma senha do Linux. Anote a senha: ela é pedida no `sudo`.

A partir daqui, **todos os comandos são digitados no terminal do Ubuntu**, não no PowerShell.

## 2. Instalar as ferramentas (uma vez)

Copie e cole no terminal do Ubuntu:

```bash
sudo apt update
sudo apt install -y git curl rsync postgresql nginx openjdk-21-jdk maven \
                    python3 python3-venv libpango-1.0-0 libpangoft2-1.0-0
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Confira se tudo instalou:

```bash
node -v      # v22.x
java -version  # 21
mvn -v
psql --version
```

## 3. Baixar o projeto para a Área de Trabalho (uma vez)

Ainda no Ubuntu (troque `joao.gehlen` pelo seu usuário do Windows, se for outro):

```bash
cd /mnt/c/Users/joao.gehlen/Desktop
git clone https://github.com/joaogehlen/MedicalField.git
cd MedicalField
git config --global --add safe.directory "$PWD"
```

> A última linha autoriza o Git a usar uma pasta do Windows (sem ela, `git pull` falha com *“detected dubious ownership”*).

Pronto: a pasta **MedicalField** aparece na sua Área de Trabalho do Windows.

> Clone **pelo Ubuntu**, como acima, e não pelo Git do Windows. Assim os scripts ficam no formato que o Linux espera.
>
> Se o GitHub pedir login (repositório privado), use seu usuário e um *token* criado em github.com → Settings → Developer settings → Personal access tokens.

## 4. Subir o sistema

> ⚠️ **Os comandos `.sh` NÃO funcionam no PowerShell, no Prompt de Comando nem no terminal do Windows do VS Code.** Se aparecer “Este arquivo não tem um aplicativo associado”, você está no terminal do Windows. Use um dos dois jeitos abaixo.

### Jeito A — dois cliques (mais fácil)

Na pasta **MedicalField** da Área de Trabalho:

| Arquivo | O que faz |
|---|---|
| `iniciar.bat` | Compila e sobe tudo (use na **primeira vez** e depois de mudar o código) |
| `iniciar-rapido.bat` | Sobe sem recompilar (uso normal) |
| `zerar-banco.bat` | Volta o banco aos dados de demonstração (antes de ensaiar o roteiro) |

Abre uma janela preta que chama o Ubuntu sozinha. Se pedir senha, é a do seu usuário do Ubuntu. **Deixe essa janela aberta** enquanto usa o sistema; para parar, aperte Enter nela.

### Jeito B — pelo terminal do Ubuntu

Abra o **Ubuntu** pelo menu Iniciar (ou digite `wsl` no PowerShell; o prompt muda para algo como `joao@PC:~$`). Então:

```bash
cd /mnt/c/Users/joao.gehlen/Desktop/MedicalField
sudo infra/scripts/start-all.sh
```

Na primeira vez ele instala as dependências e compila os três serviços e os dois apps (5 a 10 minutos). Nas próximas vezes, para subir sem recompilar:

```bash
sudo MF_BUILD=0 infra/scripts/start-all.sh
```

Deixe a janela do Ubuntu aberta enquanto usa o sistema. Quando terminar, aparece:

```
  Cliente (socorrista):  http://localhost:8080/app/
  Portal (regulação):    http://localhost:8080/portal/
  API (Postman):         http://localhost:8080/api
```

Abra esses endereços **no navegador do Windows** (Chrome, Edge…). Eles funcionam direto.

### Logins de demonstração (senha: `medicalfield`)

| Onde | Tipo de registro | Número | UF |
|---|---|---|---|
| **Portal** (regulação) | ID Socorrista | `0001` | — |
| **Cliente** (médica) | CRM | `12345` | RS |
| **Cliente** (enfermeiro) | COREN | `54321` | RS |
| **Cliente** (socorrista) | ID Socorrista | `2048` | — |

## 5. Usar no dia a dia

| Quero… | Comando (no Ubuntu, dentro da pasta) |
|---|---|
| Subir tudo | `sudo MF_BUILD=0 infra/scripts/start-all.sh` |
| Subir recompilando (depois de mudar o código) | `sudo infra/scripts/start-all.sh` |
| **Atualizar o projeto** (baixar a versão nova do GitHub) | `git pull`, depois `sudo infra/scripts/reset-db.sh` e `sudo infra/scripts/start-all.sh` (ou dois cliques em `zerar-banco.bat` e `iniciar.bat`). Zere o banco sempre que a atualização mudar as tabelas. |
| Parar tudo | `sudo infra/scripts/stop-all.sh` |
| Zerar o banco (antes de ensaiar o roteiro) | `sudo infra/scripts/reset-db.sh` e depois subir de novo |
| Ver os logs | pasta `.runtime/logs/` (dá para abrir pelo Windows: `Área de Trabalho\MedicalField\.runtime\logs`) |
| Ver os e-mails enviados | pasta `.runtime/mail/` — cada e-mail é um `.eml` com o PDF anexo. Dê dois cliques para abrir no Outlook/Correio. |
| Abrir o código no VS Code | `code .` (com a extensão **WSL** instalada no VS Code) |

## 6. Ensaiar o roteiro da apresentação

1. `sudo infra/scripts/reset-db.sh` e `sudo MF_BUILD=0 infra/scripts/start-all.sh`.
2. Deixe o **portal** numa janela e o **cliente** em outra, lado a lado.
3. Siga a tabela de [docs/06-roteiro-testes.md](docs/06-roteiro-testes.md). Para o **passo 9** (inserir medicamentos pelo banco), rode no Ubuntu:
   ```bash
   infra/scripts/passo-09.sh
   ```
4. Para o **passo 12**, use a chave **Online/Offline** no topo do cliente: a faixa listrada amarela mostra que está offline.

### Rodar o roteiro inteiro sozinho (opcional)

O roteiro abre um navegador invisível e executa os 17 passos:

```bash
cd tests/e2e
npm install
npx playwright install --with-deps chromium
node roteiro.mjs
```

As capturas de cada passo ficam em `.runtime/roteiro/`.

## 7. Testar a API no Postman

1. Instale o Postman no Windows.
2. **Import** → escolha `Área de Trabalho\MedicalField\postman\MedicalField.postman_collection.json`.
3. Rode primeiro **Autenticação → Login (CRM)**. O token é guardado sozinho e as outras requisições já usam.

## 8. E-mail de verdade (opcional)

Sem configuração, os e-mails viram arquivos `.eml` (item 5). Para enviar de verdade (por exemplo, por uma conta Gmail com **senha de app**), crie o arquivo `.runtime/env/smtp.env` com:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sua.conta@gmail.com
SMTP_PASSWORD=senha-de-app-de-16-letras
SMTP_FROM="MedicalField <sua.conta@gmail.com>"
```

Depois suba de novo com `sudo MF_BUILD=0 infra/scripts/start-all.sh`.

## 9. Problemas comuns

| Sintoma | Solução |
|---|---|
| `fatal: detected dubious ownership in repository` no `git pull` | Rode uma vez, dentro da pasta: `git config --global --add safe.directory "$PWD"` e repita o `git pull`. |
| `password authentication failed for user "mf_identity"` | Atualize o projeto (`git pull`) e suba de novo: o script agora detecta a porta do PostgreSQL. Se persistir, pare o PostgreSQL instalado no Windows (Win+R → `services.msc` → *postgresql-x64-…* → Parar). |
| “Este arquivo não tem um aplicativo associado” ao rodar um `.sh` | Você digitou no terminal do Windows. Use `iniciar.bat` ou abra o **Ubuntu** (item 4). |
| `'wsl' não é reconhecido` | Falta instalar o WSL (item 1). |
| `\r: command not found` ao rodar um script | O projeto foi clonado pelo Git do Windows. Apague a pasta e clone de novo **pelo Ubuntu** (item 3). |
| `Nenhum cluster PostgreSQL encontrado` | `sudo apt install postgresql` |
| `falhou — veja .runtime/logs/` | Abra o log do serviço que não subiu (`identity.log`, `clinical.log` ou `document.log`) em `.runtime/logs/`. |
| A porta 8080 já está em uso | Suba em outra porta: `sudo MF_PORT=8090 MF_BUILD=0 infra/scripts/start-all.sh` |
| A primeira compilação está muito lenta | É normal na pasta do Windows (`/mnt/c`). Se incomodar, clone em `~/MedicalField` dentro do Ubuntu; o resto do guia não muda. |
| Login no cliente diz “Este aparelho ainda não tem seu acesso” | Você está offline e nunca entrou com esse usuário neste navegador. Ligue a chave **Online** e entre uma vez. |

## 10. Na VM da Univates (Docker)

Na VM, o sistema roda em containers Docker. Entre por SSH e rode:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/joaogehlen/MedicalField.git && cd MedicalField
./mf.sh instalar-docker
MF_ENDERECO=<IP-da-VM> ./mf.sh subir
```

Depois, `./mf.sh ajuda` lista os comandos (status, logs, passo 9, zerar…). Passo a passo completo em [docs/07-implantacao-vm.md](docs/07-implantacao-vm.md).
