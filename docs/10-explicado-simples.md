# 10 — Explicado para um macaco 🐒

Guia da apresentação em linguagem simples. **A apresentação é toda online, na VM da Univates** (Docker): troque `<IP-da-VM>` pelo endereço da VM, ou rode `./mf.sh enderecos` na VM para ver os links prontos.

Para cada assunto: **o que é**, **como funciona por dentro**, **onde está no código**, **como mostrar (cliques)** e **o que falar**.

Ordem sugerida: **1. Login → 2. Rotas da API (PDF) → 3. Insomnia → 4. PDF do prontuário → 5. E-mail no Mailpit → 6. Padrões de projeto no código.**

---

## 0. O sistema em 30 segundos

> O socorrista anota o atendimento no celular **mesmo sem internet**. Quando a internet volta, tudo vai sozinho para a central. A central vê pelo portal, gera a ficha em **PDF** e manda por **e-mail** para a família.

Quem é quem (pense numa **fazenda de macacos**):

| Peça | O que é | Comparação |
|---|---|---|
| **Cliente** (`/app/`) | Tela do socorrista, funciona offline | O macaco no campo com um caderninho |
| **Portal** (`/portal/`) | Tela da central | O escritório da fazenda |
| **Nginx** (gateway) | A porta de entrada única: olha o endereço e manda para o serviço certo | O porteiro |
| **identity-service** (Java) | Login e token | O guarda que entrega o crachá |
| **clinical-service** (TypeScript) | Pessoas, prontuários, atendimentos, sincronização | O arquivo de fichas |
| **document-service** (Python) | Gera o PDF e manda o e-mail | A gráfica + o correio |
| **PostgreSQL** | O banco de dados (um *schema* por serviço) | O armário |
| **Mailpit** (`/email/`) | Caixa de e-mail **de mentira** para a demonstração | Uma caixa de correio de brinquedo: a carta chega, mas não sai da fazenda |

```
Cliente / Portal / Insomnia
          │  http://<IP-da-VM>/api/...
          ▼
        Nginx ──/api/auth, /api/profissional, /api/log──► identity-service (Java)
          │────/api/ficha/...────────────────────────────► document-service (Python) ──► Mailpit
          └────/api/... (o resto)────────────────────────► clinical-service (TypeScript)
```

### Antes de começar (checklist)

1. Entrar na VM por SSH (`ssh univates@<IP-da-VM>`), ir para a pasta (`cd MedicalField`) e preparar:
    - `./mf.sh status` → todos os containers `Up`? (se não: `./mf.sh subir`)
    - `./mf.sh zerar` → volta o banco aos dados de demonstração (faça antes de ensaiar e antes de apresentar)
    - `./mf.sh enderecos` → mostra os links abaixo já com o IP
2. Abrir no navegador, cada um numa aba:

| O quê | Endereço |
|---|---|
| Portal (central) | `http://<IP-da-VM>/portal/` |
| Cliente (socorrista) | `http://<IP-da-VM>/app/` |
| Mailpit (e-mails) | `http://<IP-da-VM>/email/` |
| API (Insomnia) | `http://<IP-da-VM>/api` |

> Se a VM usa outra porta (variável `PORTA` no `.env`, por exemplo 8080), o endereço fica `http://<IP-da-VM>:8080/portal/`, e assim por diante.

3. Abrir o **Insomnia** com a coleção importada (item 3).
4. Abrir o **PDF das rotas**: `Área de Trabalho\MedicalField\docs\MedicalField-Rotas-API.pdf`.
5. Abrir o **VS Code** na pasta do projeto (para mostrar os padrões).

Senha de todos: **`medicalfield`**.

| Onde | Tipo | Número | UF |
|---|---|---|---|
| Portal | ID Socorrista | `0001` | — |
| Cliente (médica) | CRM | `12345` | RS |
| Cliente (enfermeiro) | COREN | `54321` | RS |

---

## 1. Login

### O que é (macaco)

O macaco chega na porta e mostra o **registro profissional** (CRM, COREN ou ID de socorrista) e a **senha**. Se estiver certo, o guarda entrega um **crachá** (o *token JWT*). Daí em diante, em **toda** porta que ele passar, mostra o crachá. Sem crachá → **401**, não entra.

### Como funciona por dentro

```
POST /api/auth/login  { tipoRegistro, numeroRegistro, uf, senha }
   1. procura o profissional pelo registro (CRM/COREN precisam de UF; socorrista não)
   2. está ativo? a senha bate com o hash Argon2 do banco?
   3. errou  → 401 CREDENCIAIS_INVALIDAS
      acertou → { accessToken, expiresIn: 43200 (12 h), profissional }
```

- O crachá é **assinado** com uma chave **privada** que só o identity-service tem (RS256).
- Os outros serviços conferem o crachá com a chave **pública**: não precisam perguntar nada ao identity-service. É como conferir um selo holográfico.
- Dentro do token vão: id, nome, papel (MEDICO, ENFERMEIRO, SOCORRISTA, ADMIN) e registro.
- No **cliente**, a sessão fica guardada no aparelho; por isso o socorrista continua logado **mesmo sem internet**.

### Onde está no código

| O quê | Arquivo |
|---|---|
| A rota `/auth/login` | `services/identity-service/src/main/java/br/univates/medicalfield/identity/api/AuthController.java` |
| O passo a passo do login | `services/identity-service/.../service/AuthService.java` (método `login`) |
| Criar e validar o token | `services/identity-service/.../security/JwtService.java` (`emitir` e `validar`) |
| Conferir o token no clinical-service | `services/clinical-service/src/common/auth.ts` (`JwtAuthGuard`) |
| Conferir o token no document-service | `services/document-service/app/auth.py` (`usuario_atual`) |
| Tela de login do cliente / portal | `apps/client/src/ui/pages/Entrar.tsx` · `apps/portal/src/pages/Entrar.tsx` |

### Como mostrar

1. No **portal**, entre com senha errada → aparece “Registro profissional ou senha incorretos”.
2. Entre com `0001` / `medicalfield` → abre a tela de atendimentos.
3. No **Insomnia**: rode **1. Sem token → 401**, depois **2. Login (CRM)** e mostre o `accessToken` na resposta.
4. (Extra) Cole o token em https://jwt.io para mostrar o que tem dentro.

### O que falar

> “O login é a única rota pública. Ele devolve um token JWT assinado com RS256. Todas as outras rotas, nos três serviços, exigem esse token no cabeçalho `Authorization: Bearer`. Cada serviço confere a assinatura sozinho, com a chave pública.”

**Se perguntarem — “Por que RS256 e não uma senha compartilhada?”** Porque só o identity-service consegue **criar** tokens (tem a chave privada). Os outros só conseguem **conferir**. Se um serviço for invadido, o invasor não consegue fabricar crachás.

---

## 2. Rotas da API (com o PDF)

### O que é (macaco)

As rotas são os **guichês** da fazenda. Cada guichê tem um endereço e faz uma coisa só. O **PDF das rotas** é o **cardápio**: diz qual guichê existe, o que mandar e o que volta.

**Arquivo:** `Área de Trabalho\MedicalField\docs\MedicalField-Rotas-API.pdf` (24 páginas, com respostas reais).

### As 15 rotas (e a página do PDF)

| # | Método | Rota | Serviço | Faz o quê | Pág. |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | identity (Java) | Login, devolve o token | 4 |
| 2 | GET | `/api/profissional` | identity | Lista os profissionais | 5 |
| 3 | POST | `/api/log` | identity | Recebe os logs do aparelho | 5 |
| 4 | GET | `/api/medicamento` | clinical (TS) | Catálogo de medicamentos | 7 |
| 5 | POST | `/api/pessoa` | clinical | Cria/atualiza a vítima | 7 |
| 6 | GET | `/api/prontuario` | clinical | Lista prontuários (com busca) | 8 |
| 7 | GET | `/api/prontuario/{id}` | clinical | Um prontuário com os atendimentos | 9 |
| 8 | POST | `/api/prontuario` | clinical | Cria/atualiza prontuário | 11 |
| 9 | GET | `/api/atendimento` | clinical | Lista atendimentos | 12 |
| 10 | GET | `/api/atendimento/{pessoaId}` | clinical | Atendimentos de uma pessoa | 12 |
| 11 | GET | `/api/atendimento/detalhe/{id}` | clinical | Atendimento completo | 13 |
| 12 | POST | `/api/atendimento` | clinical | Registra atendimento | 16 |
| 13 | GET | `/api/sync/pull?cursor={n}` | clinical | O aparelho busca o que mudou | 19 |
| 14 | GET | `/api/ficha/{id}/pdf` | document (Python) | Gera o PDF | 23 |
| 15 | POST | `/api/ficha/{id}/email` | document | Manda o PDF por e-mail | 23 |

### As 4 regras que valem para todas (pág. 2–3 do PDF)

1. **Token:** toda rota, menos o login, precisa de `Authorization: Bearer <token>`. Sem ele → **401**.
2. **Idempotência:** os `POST` de pessoa, prontuário e atendimento aceitam `Idempotency-Key`. Mandou duas vezes a mesma coisa (internet caiu no meio)? A central responde igual e **não grava duas vezes**.
3. **Toda escrita responde** `{ "resultado": "CRIADO" | "ATUALIZADO" | "MESCLADO", "registro": {...} }`.
4. **Erros sempre no mesmo formato** (RFC 7807): `{ title, status, detail, codigo }`. Exemplos: 401 sem token, 409 dependência ausente, 422 regra clínica.

### Quem decide para qual serviço vai? O Nginx.

Arquivo: `infra/nginx/medicalfield.conf.template` (ou `infra/docker/gateway/nginx.conf` no Docker). Ele olha o começo do endereço, tira o `/api` e repassa:

- `/api/auth`, `/api/profissional`, `/api/log` → identity (Java)
- `/api/ficha/...` → document (Python)
- todo o resto de `/api/...` → clinical (TypeScript)

### O que falar

> “São 15 rotas em três serviços, cada um numa linguagem. O cliente só conhece um endereço, o `/api` do Nginx, que repassa para o serviço certo. O PDF documenta cada rota com parâmetros, corpo, resposta real e erros.”

---

## 3. Insomnia

### O que é (macaco)

O Insomnia é um **controle remoto da API**: você aperta um botão e ele faz a chamada, sem precisar de tela. Serve para mostrar que as rotas funcionam **sozinhas**, sem o portal.

### Importar (uma vez)

1. Abra o Insomnia → **Import** → escolha `Área de Trabalho\MedicalField\insomnia\MedicalField.insomnia.json`.
2. No canto superior esquerdo, escolha o ambiente **VM Univates**. Clique em **Manage Environments** e troque `IP-DA-VM` pelo IP da VM (fica `http://<IP>/api`; com porta, `http://<IP>:8080/api`).
3. Pronto. **O token é automático:** as requisições pegam o `accessToken` da resposta do **Login (CRM)** sozinhas (e refazem o login quando ele expira).

### A pasta “0 · Roteiro da apresentação” (rode na ordem)

| # | Requisição | O que acontece | O que mostra |
|---|---|---|---|
| 1 | Sem token → 401 | `GET /medicamento` sem crachá | Segurança: **401 NAO_AUTENTICADO** |
| 2 | Login (CRM) | `POST /auth/login` | Volta o `accessToken` |
| 3 | Medicamentos (com token) | mesma rota do 1, agora com crachá | **200** com a lista |
| 4 | Cadastrar pessoa | `POST /pessoa` com `Idempotency-Key` fixa | **201 CRIADO** |
| 5 | Repetir com a mesma Idempotency-Key | manda o 4 de novo | Mesma resposta, **não duplica** |
| 6a | Cadastrar prontuário | alergia **Penicilina** | **201** |
| 6b | Cadastrar atendimento | com sinais vitais e triagem | **201** |
| 7 | Atendimento com dose 20 mg → 422 | Ondansetrona tem dose máxima 8 mg | **422 REGRA_CLINICA** (Chain of Responsibility) |
| 8 | Ficha em PDF | `GET /ficha/{id}/pdf` | Aba **Preview** mostra o PDF |
| 9 | Enviar ficha por e-mail | `POST /ficha/{id}/email` | `enviadoPara` + `messageId` → abrir o Mailpit |
| 10 | Login com senha errada → 401 | senha errada | **401 CREDENCIAIS_INVALIDAS** |

> Dica: rode o roteiro **logo depois de zerar o banco**. Os ids da pessoa, prontuário e atendimento ficam fixos no ambiente.

Fora do roteiro há uma pasta por serviço (identity, clinical, document) com **todas** as rotas, para responder “e a rota X?”.

**Extra para mostrar o Strategy:** pasta *clinical-service* → **Cadastrar prontuário**, troque as alergias para `["Látex"]` e envie: a resposta vem **MESCLADO** com Penicilina **e** Látex.

---

## 4. Gerar o PDF do prontuário

### O que é (macaco)

É a **ficha de papel** do atendimento: junta os dados da vítima, do **prontuário** (tipo sanguíneo, **alergias em destaque**, comorbidades) e do atendimento (triagem, Glasgow, sinais vitais, medicamentos, quem atendeu) num PDF bonito para imprimir ou mandar.

### Como funciona por dentro

```
Portal: botão "Gerar ficha (PDF)"
   └► GET /api/ficha/{atendimentoId}/pdf        (Nginx manda para o document-service)
        1. document-service pede ao clinical-service o atendimento completo
           (GET /atendimento/detalhe/{id}, repassando o MESMO token)
        2. Builder monta a ficha camada por camada:
           cabecalho → paciente (+ prontuário) → ocorrencia → avaliacao → medicamentos → responsavel
        3. build(): coloca os dados no template HTML (ficha.html) e o WeasyPrint vira PDF
        4. devolve o arquivo ficha-atendimento-xxxx.pdf
```

O document-service **não tem** os dados clínicos: ele pergunta ao clinical-service. Cada serviço cuida só do que é seu.

### Onde está no código

| O quê | Arquivo |
|---|---|
| A rota | `services/document-service/app/routers.py` (`baixar_pdf`) |
| Busca no clinical-service | `services/document-service/app/clinical_client.py` |
| Montagem (padrão **Builder**) | `services/document-service/app/ficha/builder.py` |
| O visual da ficha | `services/document-service/app/ficha/templates/ficha.html` |
| O botão no portal | `apps/portal/src/pages/AtendimentoDetalhe.tsx` |

### Como mostrar

1. Portal → **Atendimentos** → clique num atendimento.
2. Botão **Gerar ficha (PDF)** → o PDF abre numa aba nova.
3. Aponte: a **classificação de risco** colorida no topo, as **alergias em destaque**, Glasgow, sinais vitais, medicamentos e o profissional responsável.
4. (Insomnia) requisição **8. Ficha em PDF** → aba Preview.

### O que falar

> “A ficha é gerada na hora pelo document-service, em Python. Ele busca o atendimento no clinical-service com o mesmo token de quem pediu, monta o documento com o padrão Builder e converte HTML em PDF com o WeasyPrint.”

---

## 5. E-mail no Mailpit

### O que é (macaco)

O portal manda a ficha em PDF por e-mail para o **familiar**. Na apresentação, não queremos mandar e-mail de verdade para ninguém. Então usamos o **Mailpit**: um **servidor de e-mail de brinquedo**. Ele recebe a carta como um servidor de verdade (SMTP), mas **guarda tudo numa caixa que você abre no navegador**, em vez de entregar.

### Como funciona por dentro

```
Portal: "Enviar ficha" (e-mail do familiar já preenchido)
   └► POST /api/ficha/{id}/email   { "email": "...", "nome": "..." }
        1. gera o MESMO PDF do item 4
        2. monta a mensagem: assunto, texto e o PDF anexo
        3. Adapter entrega: SmtpEmailAdapter → SMTP do Mailpit (porta 1025)
        4. grava o envio na tabela document.envio_email (ENVIADO ou FALHOU)
        5. responde { enviadoPara, messageId }
Mailpit: http://<IP-da-VM>/email/  → a mensagem aparece com o PDF anexo
```

**Por que dá para trocar o Mailpit por um Gmail de verdade sem mudar o código?** Por causa do padrão **Adapter**: o código só chama `enviar(mensagem)`. Quem decide **como** entregar é a configuração (`SMTP_HOST`). Mailpit, Gmail ou arquivo `.eml`: o resto do sistema nem percebe.

### Onde está no código

| O quê | Arquivo |
|---|---|
| A rota | `services/document-service/app/routers.py` (`enviar_email`) |
| Os adaptadores (padrão **Adapter**) | `services/document-service/app/email/adapters.py` |
| O Mailpit (container `email`) | `docker-compose.yml` — o document-service manda para `email:1025` |
| O endereço `/email/` | Nginx do gateway: `infra/docker/gateway/nginx.conf` |

### Como mostrar

1. Portal → abra o atendimento → **Enviar ficha** (o e-mail do familiar já vem preenchido) → aparece “Ficha enviada para …”.
2. Abra a aba do **Mailpit** (`http://<IP-da-VM>/email/`) → a mensagem chegou → clique nela → mostre o texto e o **anexo PDF** (dá para abrir).
3. (Insomnia) requisição **9. Enviar ficha por e-mail** → atualize o Mailpit: chegou outra.

### O que falar

> “O e-mail sai por SMTP de verdade. Na demonstração, o servidor SMTP é o Mailpit, que guarda as mensagens para a gente ver no navegador. Para mandar de verdade, basta mudar as variáveis SMTP: o código não muda, por causa do padrão Adapter.”

---

## 6. Padrões de projeto no código

### Como achar no VS Code

`Ctrl+Shift+F` → pesquise **`PADRÃO`**. Cada um dos 7 arquivos começa com um comentário curto: o nome do padrão, uma comparação e como funciona. Explicação completa, com as linhas: [09-design-patterns.md](09-design-patterns.md) ([PDF](MedicalField-Design-Patterns.pdf)).

### Os 7 padrões em uma tabela de macaco

| Padrão | Comparação | Arquivo | O problema que resolve |
|---|---|---|---|
| **Repository** *(exigido)* | Balcão do almoxarifado: você pede, não sabe a prateleira | `apps/client/src/data/repositories.ts` | A tela não sabe se o dado vem do aparelho (offline) ou da API |
| **Strategy** *(exigido)* | Cada campeonato tem sua regra de desempate | `services/clinical-service/src/sync/strategies.ts` | Dois aparelhos editaram o mesmo registro: quem vence? |
| **Observer** *(exigido)* | Grupo de avisos da turma | `apps/client/src/sync/network.ts` | A internet voltou → avisa o sincronizador sozinho |
| **Command** | Comanda do restaurante | `apps/client/src/sync/commands.ts` | Guardar o que foi feito offline numa fila e executar depois |
| **Chain of Responsibility** | Fila de fiscais | `packages/shared/src/clinical/safety.ts` | Conferir via, dose máxima e alergia antes de dar remédio |
| **Builder** | Hambúrguer montado em camadas | `services/document-service/app/ficha/builder.py` | Montar a ficha PDF seção por seção |
| **Adapter** | Adaptador de tomada | `services/document-service/app/email/adapters.py` | Mandar e-mail por SMTP (Mailpit/Gmail) ou arquivo, com o mesmo código |

### Cada um em 3 frases

**Repository** — A tela só fala `local.pessoas.listar()`. Por trás, isso lê o IndexedDB do aparelho; o envio para a central usa `remoto.pessoas.salvar()`. Se um dia trocarmos o banco, só esse arquivo muda.

→ **Mostrar:** chave em **Offline** → **Pacientes** continua listando.

**Strategy** — Todas as estratégias têm o mesmo método `resolve(servidor, recebido)`. Pessoa usa *a edição mais nova vence*; prontuário usa *mesclar* (alergias nunca somem); atendimento usa *o servidor vence*. O serviço só chama `this.estrategia.resolve(...)` sem saber qual é.

→ **Mostrar:** Insomnia → Cadastrar prontuário com `["Látex"]` → resposta **MESCLADO** com as duas alergias.

**Observer** — O `NetworkMonitor` guarda a lista de quem quer saber da rede (`subscribe`). Quando a rede muda, chama `onNetworkChange(online)` em todos (`notify`). O `SyncEngine` é um desses e, quando a rede volta, envia a fila sozinho.

→ **Mostrar:** cliente em **Offline**, salve um atendimento (“pendente”) → volte para **Online** → vira “Na central” sem clicar em nada.

**Command** — Cada coisa salva offline vira um pedido na fila (Outbox). O sincronizador pega cada pedido e chama `execute()`. Se a rede cair no meio, o pedido continua na fila; reenviar não duplica por causa da `Idempotency-Key`.

→ **Mostrar:** tela **Sincronização** do cliente com os “pendentes”; ou F12 → Application → IndexedDB → `outbox`.

**Chain of Responsibility** — O pedido de remédio passa por `ViaRule → DoseMaximaRule → AlergiaRule`. Cada fiscal confere só a sua parte, anota um alerta e passa adiante. A mesma corrente roda no aparelho (offline) e no servidor.

→ **Mostrar:** paciente alérgico a Dipirona → tentar Dipirona → **“Administração bloqueada”**; ou Insomnia **7** → **422**.

**Builder** — A ficha é montada em camadas: `.cabecalho().paciente().ocorrencia().avaliacao().medicamentos().responsavel().build()`. Cada método preenche um pedaço e devolve o próprio builder. `build()` transforma tudo em PDF.

→ **Mostrar:** gerar a ficha (item 4) e apontar que cada bloco do PDF é um método.

**Adapter** — O sistema só conhece `EmailSender.enviar(mensagem)`. `SmtpEmailAdapter` traduz para SMTP; `ArquivoEmailAdapter` grava um `.eml`. `criar_sender()` escolhe pela configuração.

→ **Mostrar:** enviar a ficha (item 5) e abrir no Mailpit.

### O que falar

> “Os três padrões exigidos são Repository, Strategy e Observer. Usamos mais quatro onde eles resolviam um problema real: Command para a fila offline, Chain of Responsibility para as regras de segurança dos medicamentos, Builder para a ficha em PDF e Adapter para o envio de e-mail.”

---

## Colinha final (uma linha por assunto)

| Assunto | Uma frase |
|---|---|
| Login | Registro + senha → token JWT RS256; sem token, 401 em tudo. |
| Rotas | 15 rotas, 3 serviços, 3 linguagens, um só endereço (`/api`) pelo Nginx; tudo no PDF. |
| Insomnia | Importa, escolhe o ambiente, roda o Login uma vez; o resto pega o token sozinho. |
| PDF | document-service busca o atendimento no clinical-service e monta a ficha com Builder + WeasyPrint. |
| E-mail | Mesmo PDF em anexo, entregue por SMTP (Adapter) ao Mailpit, visto em `/email/`. |
| Padrões | Repository, Strategy, Observer (exigidos) + Command, Chain, Builder, Adapter. Busque `PADRÃO` no VS Code. |
