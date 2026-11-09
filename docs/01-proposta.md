# 01 — Extração da Proposta

> Fonte: *Trabalho Final — MedicalField*, disciplina **4815206 – Arquiteturas de Software**, Prof. Fabrício, 2026/B.
> Tudo o que a proposta pede, reorganizado em requisitos numerados, com o lugar onde cada um foi implementado.

## 1. Contexto do problema

| Item | O que a proposta diz |
|---|---|
| Domínio | Prontuário médico de emergência para atendimento **pré-hospitalar** (SAMU, ambulâncias de rodovia, desastres). |
| Problema | Conectividade instável, lenta ou inexistente no local. |
| Dados críticos | Sinais vitais, **Escala de Glasgow**, triagem (**Manchester** e **START**) e **medicamentos administrados**. |
| Por que registrar na hora | Evitar erro de medicação (dose excessiva, reação adversa) e garantir a continuidade na entrega ao hospital. |
| Abordagem exigida | **Offline-First**: operação local irrestrita; sincroniza ao recuperar o sinal, com **idempotência**, **rastreabilidade auditável** e **tratamento de conflitos**. |
| Composição | **≥ 3 microsserviços em linguagens distintas** + **interface administrativa** + **aplicação cliente com GUI**. |
| Transações adicionais | **Ficha de Atendimento em PDF** e **envio por e-mail** (anexo) a paciente ou familiar. |

## 2. Requisitos funcionais

| ID | Requisito | Onde está |
|---|---|---|
| RF01 | Autenticar por **CRM, COREN ou ID de Socorrista** | identity-service `POST /auth/login`; cliente e portal |
| RF02 | Cadastrar **pessoa** online e offline | clinical `POST /pessoa`; cliente “Nova ocorrência” |
| RF03 | Cadastrar e consultar **prontuário** | clinical `POST/GET /prontuario`; cliente e portal |
| RF04 | Registrar **atendimento** (sinais vitais, Glasgow, triagem, medicamentos) | clinical `POST /atendimento`; cliente “Novo atendimento” |
| RF05 | Consultar atendimentos de uma pessoa | clinical `GET /atendimento/{pessoaId}` |
| RF06 | Catálogo de **medicamentos** e **regras de segurança clínica**, inclusive offline | `ClinicalSafetyChain` em `packages/shared`, executada no aparelho e revalidada no servidor |
| RF07 | **Sincronização** bidirecional | cliente `SyncEngine` (push pela Outbox, pull por cursor); clinical `GET /sync/pull` |
| RF08 | **Simulador de conectividade** | chave “Online/Offline” na casca do cliente |
| RF09 | Enviar **logs locais gerados offline** | identity `POST /log` |
| RF10 | **Ficha em PDF** | document `GET /ficha/{id}/pdf` |
| RF11 | **E-mail com a ficha anexa** | document `POST /ficha/{id}/email` |
| RF12 | **Portal**: autenticar, ver atendimentos, prontuários e cadastros de apoio | `apps/portal` |
| RF13 | Cadastros de apoio inseridos **direto no banco** | `infra/db/roteiro/passo-09-novos-medicamentos.sql` + trigger de sincronização |

## 3. Requisitos não funcionais

| ID | Requisito | Como foi atendido |
|---|---|---|
| RNF01 | ≥ 3 serviços em **linguagens diferentes** | **Java** (identity), **TypeScript** (clinical), **Python** (document) |
| RNF02 | **Persistência dual** | PostgreSQL 16 (central) + IndexedDB/Dexie (embarcado no cliente) |
| RNF03 | Rodar na **VM da Univates**, sem contêineres | Nginx + systemd + PostgreSQL nativos ([07](07-implantacao-vm.md)) |
| RNF04 | Todas as rotas autenticadas, exceto login | JWT RS256 validado em cada serviço; só `POST /auth/login` e `/auth/refresh` são públicas |
| RNF05 | **Log de acesso** em todos os serviços | Middleware/filtro nos três serviços com data/hora, IP, profissional, método, rota, status e tempo (ms) |
| RNF06 | Idempotência | `Idempotency-Key` em toda escrita + IDs UUID v7 gerados no aparelho |
| RNF07 | Rastreabilidade | `registrado_por` × `sincronizado_por`, `dispositivo_id`, logs do aparelho, `processed_operation`, `sync_conflito` |
| RNF08 | Tratamento de conflitos | *Strategies* (LWW, FieldMerge, AppendOnlyUnion, ServerWins) |
| RNF09 | Testável no Postman/Insomnia | `postman/MedicalField.postman_collection.json` |
| RNF10 | GUI para todo o roteiro | Roteiro automatizado aprovado 17/17 ([06](06-roteiro-testes.md)) |

## 4. Padrões de projeto

| Padrão | Exigido? | Onde |
|---|---|---|
| Repository | sim | `apps/client/src/data/repositories.ts` (local Dexie × remoto REST); repositórios JDBC no identity |
| Strategy | sim | `services/clinical-service/src/sync/strategies.ts` |
| Observer | sim | `apps/client/src/sync/network.ts` (Subject) → `sync/engine.ts` (Observer) |
| Command | livre | `apps/client/src/sync/commands.ts` (itens da Outbox) |
| Chain of Responsibility | livre | `packages/shared/src/clinical/safety.ts` |
| Builder | livre | `services/document-service/app/ficha/builder.py` |
| Adapter *(extra)* | livre | `services/document-service/app/email/adapters.py` |

## 5. Endpoints sugeridos × implementados

| Sugerido | Implementado |
|---|---|
| `POST /auth/login` | ✔ identity |
| `GET /medicamento` | ✔ clinical |
| `GET /prontuario` | ✔ clinical (paginado) |
| `GET /prontuario/{id}` | ✔ clinical |
| `POST /pessoa` | ✔ clinical (upsert idempotente) |
| `GET /atendimento/{id}` | ✔ clinical — `{id}` é o id da **pessoa**, como diz a proposta |
| `POST /prontuario` | ✔ clinical |
| `POST /atendimento` | ✔ clinical |
| `POST /log` | ✔ identity |
| E-mail e PDF | ✔ document `GET /ficha/{id}/pdf`, `POST /ficha/{id}/email` |

Rotas adicionais estão em [04-apis.md](04-apis.md).

## 6. Entregáveis do dia da apresentação

| Entregável | Documento |
|---|---|
| E1 — Modelo de arquitetura: desenho + tecnologias | [02-arquitetura.md](02-arquitetura.md) |
| E2 — Documentação das APIs e modelagem dos bancos | [04-apis.md](04-apis.md), [05-banco-de-dados.md](05-banco-de-dados.md) |
| E3 — Roteiro de testes | [06-roteiro-testes.md](06-roteiro-testes.md) |

## 7. Decisões sobre pontos ambíguos

| Ambiguidade | Decisão |
|---|---|
| `GET /atendimento/{id}`: id da pessoa ou do atendimento? | Da **pessoa** (texto da proposta). Detalhe de um atendimento: `GET /atendimento/detalhe/{id}`. |
| `GET /prontuario/{id}` | `{id}` = id do prontuário (1 por pessoa). Busca por pessoa: `GET /prontuario?pessoaId=`. |
| “Cadastros de apoio” | Medicamentos, profissionais, hospitais e viaturas. |
| Rota pública para chave do JWT quebraria RNF04 | A chave pública é distribuída **como arquivo**; nenhuma rota pública além do login. |
| Login sem internet | Após um login online, o aparelho guarda uma credencial derivada (PBKDF2) e permite **login offline**. |
| Cliente “móvel” | PWA React: roda no navegador da apresentação e em celular/tablet. |
