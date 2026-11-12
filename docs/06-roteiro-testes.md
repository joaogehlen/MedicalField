# 06 — Roteiro de Testes (Entregável E3)

Os 17 passos oficiais, com a ação, a API envolvida e o resultado esperado. O roteiro inteiro também roda **automaticamente no navegador** (`tests/e2e/roteiro.mjs`), com o portal e o cliente lado a lado. Última execução: **17/17 aprovados** sobre o banco zerado. As capturas abaixo são dessa execução.

## Preparação

| # | Item | Como |
|---|---|---|
| P1 | Banco zerado com dados de demonstração | Na VM: `./mf.sh zerar` ([07](07-implantacao-vm.md)). Local sem Docker: `infra/scripts/reset-db.sh` e `infra/scripts/start-all.sh` |
| P2 | Duas janelas | Portal (`/portal`) à esquerda; cliente (`/app`) à direita, ou no celular |
| P3 | Terminal SSH na VM | para o passo 9 (`./mf.sh passo9`) |
| P4 | Postman | `postman/MedicalField.postman_collection.json` (opcional, para mostrar as rotas) |

| Acesso | Tipo | Número | Senha (demo) |
|---|---|---|---|
| Portal (regulação) | ID Socorrista | `0001` | `medicalfield` |
| Cliente (médica) | CRM | `12345` / RS | `medicalfield` |
| Cliente (enfermeiro) | COREN | `54321` / RS | `medicalfield` |
| Cliente (socorrista) | ID Socorrista | `2048` | `medicalfield` |

## Passos

| # | Onde | Ação | API | Resultado esperado |
|---|---|---|---|---|
| 1 | Portal | Entrar com `0001` | `POST /auth/login` | Tela de atendimentos. Senha errada mostra a mensagem. |
| 2 | Portal | **Cadastros** (Medicamentos, Profissionais) | `GET /medicamento`, `/profissional` | 8 medicamentos, 4 profissionais. |
| 3 | Portal | **Prontuários** | `GET /prontuario` | 2 prontuários (alergia em vermelho). |
| 4 | Portal | **Atendimentos** | `GET /atendimento` | 2 atendimentos com etiqueta de triagem. |
| 5 | Cliente | Chave em Online; entrar com CRM 12345/RS | `POST /auth/login` | Tela de atendimentos com a foto da ambulância. |
| 6 | Cliente | **Sincronizar → Receber** | `GET /sync/pull?cursor=0` | “Dados neste aparelho”: 2 pacientes, 2 atendimentos, 8 medicamentos. |
| 7 | Cliente | **Online:** Pacientes → João → Novo atendimento → preencher → **Salvar atendimento** | `POST /atendimento` | Selo “Na central” logo em seguida (Outbox enviada na hora). |
| 8 | Portal | Clicar em **Atendimentos** | `GET /atendimento` | O atendimento do passo 7 aparece; o detalhe mostra sinais e medicamento. |
| 9 | Banco | `./mf.sh passo9` (roda `infra/db/roteiro/passo-09-novos-medicamentos.sql` no `psql` do container) | — (SQL) | Cetoprofeno e Salbutamol inseridos; o *trigger* preenche `change_seq`. |
| 10 | Portal | Atendimentos (e Cadastros) | `GET /atendimento`, `/medicamento` | Atendimentos inalterados; 10 medicamentos em Cadastros. |
| 11 | Cliente | Sincronizar → Receber | `GET /sync/pull?cursor=<último>` | “10 medicamentos”: só o que mudou foi transferido. |
| 12 | Cliente | **Chave em Offline** (faixa amarela e preta). Nova ocorrência → vítima (CPF, contato com e-mail) → prontuário (alergia **Dipirona**) → atendimento (Manchester Laranja). Tentar **Dipirona** → “Administração bloqueada”. Adicionar Cetoprofeno → Salvar. | nenhuma (sem rede) | “3 pendentes”; registros com selos “Registrado offline” e “Só no aparelho”. |
| 13 | Portal | Clicar em Prontuários e em Atendimentos | `GET /prontuario`, `/atendimento` | A vítima do passo 12 **não** aparece. |
| 14 | Cliente | **Chave em Online** | `POST /pessoa`, `/prontuario`, `/atendimento`, `/log`, `GET /sync/pull` | Envio automático (Observer). Barra superior: “Tudo na central”. |
| 15 | Portal | Clicar em Prontuários e em Atendimentos | `GET /prontuario`, `/atendimento` | A vítima **aparece**, com o selo “Registrado offline”. |
| 16 | Portal | Abrir o atendimento → **Gerar ficha (PDF)** | `GET /ficha/{id}/pdf` | PDF abre em nova aba. |
| 17 | Portal | **Enviar ficha** (o e-mail do familiar já vem preenchido) | `POST /ficha/{id}/email` | “Ficha enviada para ana.ramos@…”; e-mail com o PDF anexo — abrir `http://<IP-da-VM>/email/` (caixa de demonstração) ou a caixa real, se houver SMTP configurado. |

## Capturas da execução

| Passo | Captura |
|---|---|
| 4 — Portal, atendimentos | ![](capturas/04-portal-atendimentos.png) |
| 7 — Cliente online | ![](capturas/07-cliente-online.png) |
| 12 — Vítima registrada offline | ![](capturas/12a-cliente-offline-vitima.png) |
| 12 — Alerta de alergia sem rede | ![](capturas/12b-cliente-alerta-alergia.png) |
| 12 — Três pendentes | ![](capturas/12c-cliente-offline-pendentes.png) |
| 13 — Portal ainda sem a vítima | ![](capturas/13-portal-prontuarios-sem-novo.png) |
| 14 — Sincronizado ao religar | ![](capturas/14-cliente-sincronizado.png) |
| 15 — Portal com a vítima | ![](capturas/15b-portal-atendimentos-com-novo.png) |
| 16 — Ficha emitida | ![](capturas/16-portal-ficha.png) |
| 17 — E-mail enviado | ![](capturas/17-portal-email-enviado.png) |
| Ficha em PDF | ![](capturas/18-ficha-pdf.png) |

## Demonstrações extras

| Demonstração | Como |
|---|---|
| Idempotência | No Postman, repetir `POST /atendimento` com a mesma `Idempotency-Key`: mesma resposta, sem duplicar. |
| Rota protegida | `GET /api/medicamento` sem token → 401. |
| Log de acesso | `psql` → `SELECT * FROM clinical.access_log ORDER BY id DESC LIMIT 10;` (idem `identity` e `document`). |
| Logs do aparelho | `SELECT acao, data_hora FROM identity.log_cliente ORDER BY data_hora DESC;` — inclui as ações feitas offline no passo 12. |
| Conflito | Dois navegadores offline editam as alergias do mesmo prontuário; ao sincronizar, as alergias são **unidas** e o caso fica em `clinical.sync_conflito`. |

## Rodar o roteiro automático

```bash
./mf.sh zerar                                   # ou, sem Docker: infra/scripts/reset-db.sh && infra/scripts/start-all.sh
cd tests/e2e && npm install && npx playwright install chromium
MF_DOCKER=1 MF_URL=http://localhost node roteiro.mjs   # sem Docker: node roteiro.mjs
```

## Testes automatizados

| Componente | Ferramenta | Comando | Cobre |
|---|---|---|---|
| `packages/shared` | Vitest | `npm test -w @medicalfield/shared` | Regras clínicas (via, dose máxima, alergia), Glasgow, triagem, CPF |
| clinical-service | Vitest | `npm test -w @medicalfield/clinical-service` | Strategies de conflito; e2e (com `E2E_URL`): idempotência, mescla de alergias, atendimento imutável, dependência ausente, regra clínica no servidor, pull por cursor |
| identity-service | JUnit 5 + Mockito | `mvn test` | Login por tipo de registro, senha errada, JWT |
| document-service | Pytest | `.venv/bin/pytest` | PDF gerado pelo Builder, envio por arquivo e SMTP, validação do JWT |
| Sistema | Playwright | `node tests/e2e/roteiro.mjs` | os 17 passos |
