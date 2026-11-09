# 02 — Modelo de Arquitetura (Entregável E1)

## 1. Visão geral

| Componente | Linguagem / stack | Porta | Responsabilidade |
|---|---|---|---|
| **MedicalField Campo** (`apps/client`) | TypeScript · React 18 · Vite · Dexie (IndexedDB) · PWA | `/app` | Ficha offline-first, simulador de rede, Outbox, sincronização, login offline |
| **MedicalField Portal** (`apps/portal`) | TypeScript · React 18 · Vite | `/portal` | Regulação: atendimentos, prontuários, cadastros, auditoria (somente leitura) |
| **`packages/shared`** | TypeScript · zod | — | Tipos do domínio, schemas de validação, escalas e `ClinicalSafetyChain` (usado pelo cliente, portal e clinical-service) |
| **`packages/design`** | CSS | — | Tokens, fontes e componentes visuais ([DESIGN.md](../DESIGN.md)) |
| **identity-service** | **Java 21 · Spring Boot 3.3** · Spring Security · Spring JDBC · Flyway · Nimbus JOSE · Argon2 | 8081 | Login CRM/COREN/Socorrista, JWT RS256, refresh, profissionais, `POST /log` |
| **clinical-service** | **TypeScript · Node 22 · NestJS 10** · node-postgres · migrações SQL | 3001 | Pessoas, prontuários, atendimentos, catálogo, idempotência, conflitos, pull por cursor |
| **document-service** | **Python 3.12+ · FastAPI** · SQLAlchemy · Jinja2 + WeasyPrint · smtplib | 8000 | Ficha em PDF e envio por e-mail |
| **Nginx** | — | 80 (VM) / 8080 (local) | Gateway: roteia `/api/*`, serve as SPAs, injeta `X-Request-Id`/`X-Forwarded-For` |
| **PostgreSQL 16** | — | 5432 (localhost) | Um *schema* e um usuário por serviço |

**Por que essas linguagens:** TypeScript é a linguagem principal (cliente, portal e núcleo clínico compartilham tipos, validações e a regra de segurança clínica — escritas uma vez). Java/Spring é referência em autenticação (Spring Security). Python tem as melhores bibliotecas de PDF e e-mail. As três atendem o RNF01.

## 2. Diagrama de contexto (C4 — nível 1)

```mermaid
flowchart LR
    socorrista(["👤 Socorrista / Médico / Enfermeiro<br/>(CRM · COREN · ID Socorrista)"])
    regulacao(["👤 Central de regulação"])
    familiar(["👤 Paciente / Familiar"])
    mf["🏥 MedicalField"]
    smtp[("✉️ Servidor SMTP")]
    socorrista -- "registra atendimentos<br/>online e offline" --> mf
    regulacao -- "acompanha e audita" --> mf
    mf -- "ficha em PDF" --> smtp --> familiar
```

## 3. Diagrama de contêineres (C4 — nível 2)

```mermaid
flowchart TB
    subgraph aparelho["📱 Aparelho da equipe (navegador)"]
        client["Campo — React PWA"]
        idb[("IndexedDB (Dexie)")]
        client <--> idb
    end
    subgraph escritorio["💻 Regulação"]
        portal["Portal — React"]
    end
    subgraph vm["🖥️ VM Univates (systemd, sem contêineres)"]
        nginx["Nginx :80<br/>/app · /portal · /api/*"]
        idsvc["identity-service<br/>Java · Spring Boot :8081"]
        clsvc["clinical-service<br/>TypeScript · NestJS :3001"]
        docsvc["document-service<br/>Python · FastAPI :8000"]
        subgraph pg["PostgreSQL 16"]
            sid[("identity")]
            scl[("clinical")]
            sdoc[("document")]
        end
        pem[/"jwt-public.pem"/]
    end
    smtp[("SMTP")]
    client -- "HTTPS + JWT" --> nginx
    portal -- "HTTPS + JWT" --> nginx
    nginx -- "/api/auth · /api/profissional · /api/log · /api/access-log" --> idsvc
    nginx -- "/api/pessoa · prontuario · atendimento · medicamento · apoio · sync · clinico" --> clsvc
    nginx -- "/api/ficha" --> docsvc
    idsvc --> sid
    clsvc --> scl
    docsvc --> sdoc
    docsvc -- "token relay" --> clsvc
    docsvc -- "nomes dos profissionais" --> idsvc
    docsvc --> smtp
    pem -. "valida JWT localmente" .-> clsvc & docsvc
```

| Princípio | Aplicação |
|---|---|
| Database per service | Cada serviço tem *schema* e usuário próprios, sem permissão nos outros; integração só por HTTP. |
| Offline-first | O cliente sempre grava primeiro no IndexedDB + Outbox; “online” só significa que a Outbox é drenada na hora. |
| Serviços sem estado | JWT RS256; clinical e document validam com a chave pública, sem chamar o identity. |
| Idempotent Receiver | Toda escrita aceita `Idempotency-Key` e devolve a resposta original num reenvio. |
| Auditoria em camadas | Log de acesso nos 3 serviços + logs do aparelho + histórico de operações e conflitos. |

## 4. Arquitetura do cliente

```mermaid
flowchart TB
    subgraph UI["Telas (React)"]
        telas["Ocorrências · Pacientes · Vítima · Prontuário · Atendimento · Sincronização"]
        chave["Chave Online/Offline"]
    end
    subgraph APP["Aplicação"]
        reg["services/registro.ts<br/>grava local + Outbox numa transação"]
        chain["ClinicalSafetyChain (shared)"]
    end
    subgraph DADOS["Dados"]
        local["Repository local (Dexie)"]
        remoto["Repository remoto (REST)"]
        outbox["Outbox — Commands"]
    end
    subgraph SYNC["Sincronização"]
        net["NetworkMonitor «Subject»"]
        engine["SyncEngine «Observer»"]
        api["ApiClient (JWT, Idempotency-Key, refresh)"]
    end
    telas --> local
    telas --> reg
    telas --> chain
    reg --> local & outbox
    chave --> net
    net -- "onNetworkChange(online)" --> engine
    engine -- "push FIFO" --> outbox
    outbox -- "execute()" --> remoto
    engine -- "pull por cursor" --> api
    remoto --> api
```

**Regra de ouro:** a interface nunca chama a API para gravar. A escrita vai ao banco local e gera um *Command* na Outbox na mesma transação; o `SyncEngine` é quem fala com a central.

## 5. Arquitetura dos serviços

```
HTTP → [log de acesso] → [autenticação JWT] → controller → serviço → repositório → PostgreSQL (schema próprio)
```

| Camada | identity (Spring Boot) | clinical (NestJS) | document (FastAPI) |
|---|---|---|---|
| Log de acesso | `AccessLogFilter` (`OncePerRequestFilter`, antes do Spring Security) + gravação em lote | middleware Express + fila em lote | `@app.middleware("http")` + thread gravadora |
| Autenticação | Spring Security + `JwtAuthFilter` (Nimbus) | `JwtAuthGuard` global (`crypto.verify` RS256) + `@Papeis` | dependência `usuario_atual` (PyJWT) |
| Validação | Bean Validation | schemas **zod** de `packages/shared` | Pydantic |
| Persistência | Spring JDBC | node-postgres | SQLAlchemy Core |
| Migrações | Flyway (`db/migration`) | migrador próprio (`migrations/*.sql` + `seeds/demo.sql`) | `migrations/001_schema.sql` na subida |
| Erros | Problem Details (RFC 7807) | Problem Details | Problem Details |

## 6. Segurança

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente/Portal
    participant G as Nginx
    participant I as identity (Java)
    participant K as clinical (TS)
    C->>G: POST /api/auth/login {tipoRegistro, numeroRegistro, uf, senha}
    G->>I: + X-Request-Id, X-Forwarded-For
    I->>I: argon2id.verify · bloqueio após 5 erros · JWT RS256 (15 min) + refresh (12 h)
    I-->>C: 200 {accessToken, refreshToken, profissional}
    C->>G: GET /api/medicamento (Bearer)
    G->>K: repassa
    K->>K: valida assinatura com jwt-public.pem (sem chamar o identity)
    K-->>C: 200
```

| Aspecto | Decisão |
|---|---|
| Credenciais | `CRM` / `COREN` (com UF) ou `SOCORRISTA`, + senha (argon2id). 5 tentativas erradas bloqueiam por 15 min. |
| Token | JWT RS256 com `sub`, `nome`, `papel` (`MEDICO`, `ENFERMEIRO`, `SOCORRISTA`, `ADMIN`), `registro`, `exp`, `jti`. |
| Refresh | Token opaco guardado como SHA-256, com rotação a cada uso; `POST /auth/logout` revoga. |
| Autorização | Portal e rotas de auditoria exigem `ADMIN`; medicamento controlado só por `MEDICO`/`ENFERMEIRO` (regra clínica). |
| Login offline | Credencial derivada com PBKDF2-SHA256 (150 000 iterações, @noble/hashes) guardada no IndexedDB. |

### Log de acesso (RNF05)

Cada serviço grava, em `<schema>.access_log` e em JSON no stdout: **data_hora, ip_cliente, profissional_id, metodo, rota, status_code, tempo_ms**, além de `request_id` (correlação vinda do Nginx), caminho e user-agent. O portal mostra os três logs em **Auditoria → Acessos às APIs**.

## 7. Padrões de projeto

| Padrão | Onde | Papel |
|---|---|---|
| **Repository** | `apps/client/src/data/repositories.ts` | `local.*` (Dexie) e `remoto.*` (REST) atrás da mesma interface `Repository<T>`. |
| **Strategy** | `services/clinical-service/src/sync/strategies.ts` | `LastWriteWinsStrategy`, `FieldMergeStrategy`, `AppendOnlyUnionStrategy`, `ServerWinsStrategy`. |
| **Observer** | `apps/client/src/sync/network.ts` → `engine.ts` | O `NetworkMonitor` notifica o `SyncEngine` e a casca; ao voltar a rede, a Outbox é drenada. |
| **Command** | `apps/client/src/sync/commands.ts` | Cada item da Outbox (`UpsertPessoa/Prontuario/AtendimentoCommand`) é reexecutável e idempotente. |
| **Chain of Responsibility** | `packages/shared/src/clinical/safety.ts` | Inativo → Controlado → Via → Dose máxima → Dose diária → Alergia → Intervalo. |
| **Builder** | `services/document-service/app/ficha/builder.py` | `FichaAtendimentoBuilder` monta a ficha seção por seção. |
| **Adapter** | `services/document-service/app/email/adapters.py` | `SmtpEmailAdapter` e `ArquivoEmailAdapter` atrás de `EmailSender`. |

```mermaid
classDiagram
    direction LR
    class NetworkMonitor {
      +subscribe(o)
      +isOnline() bool
      +setSimulador(online)
    }
    class NetworkObserver {
      <<interface>>
      +onNetworkChange(online)
    }
    class SyncEngine {
      +sincronizar()
      +push()
      +pull()
    }
    class OutboxCommand {
      <<interface>>
      +execute()
    }
    class Repository~T~ {
      <<interface>>
      +buscar(id)
      +listar()
    }
    class ConflictResolutionStrategy~T~ {
      <<interface>>
      +resolve(servidor, recebido) T
    }
    class RegraSeguranca {
      <<abstract>>
      +encadear(proxima)
      +avaliar(ctx)
    }
    NetworkObserver <|.. SyncEngine
    NetworkMonitor --> NetworkObserver : notifica
    SyncEngine --> OutboxCommand : executa
    OutboxCommand --> Repository~T~ : remoto.salvar
    ConflictResolutionStrategy <|.. LastWriteWinsStrategy
    ConflictResolutionStrategy <|.. FieldMergeStrategy
    ConflictResolutionStrategy <|.. AppendOnlyUnionStrategy
    ConflictResolutionStrategy <|.. ServerWinsStrategy
    RegraSeguranca <|-- AlergiaRule
    RegraSeguranca <|-- DoseMaximaRule
```

## 8. Ficha em PDF e e-mail

```mermaid
sequenceDiagram
    autonumber
    participant U as Portal/Cliente
    participant D as document (Python)
    participant K as clinical (TS)
    participant I as identity (Java)
    participant S as SMTP
    U->>D: GET /api/ficha/{id}/pdf (JWT)
    D->>K: GET /atendimento/detalhe/{id} (mesmo JWT)
    D->>I: GET /profissional/resumo?ids=… (nomes e registros)
    D->>D: FichaAtendimentoBuilder → Jinja2 → WeasyPrint · SHA-256
    D-->>U: application/pdf + X-Documento-Sha256
    U->>D: POST /api/ficha/{id}/email (Idempotency-Key)
    D->>S: e-mail com ficha-atendimento-xxxx.pdf anexo
    D-->>U: {envios:[{status: ENVIADO, messageId}]}
```

O PDF de cada versão do atendimento é gerado uma vez e reaproveitado (`documento_gerado`). Sem `SMTP_HOST`, o e-mail completo (com anexo) é gravado como `.eml` — útil para desenvolvimento e para a apresentação se a VM bloquear SMTP.

## 9. Decisões arquiteturais (ADRs)

| # | Decisão | Alternativas | Motivo |
|---|---|---|---|
| 01 | Cliente **PWA React + IndexedDB (Dexie)** | Flutter/SQLite, Electron | Roda no navegador da apresentação e no celular; mesma stack do portal. |
| 02 | **PostgreSQL** único, *schema* por serviço | Um SGBD por serviço; NoSQL | Uma instância na VM, com isolamento lógico e usuários separados. |
| 03 | **JWT RS256** com chave pública em arquivo | HS256 compartilhado; JWKS público | Só o identity assina; nenhuma rota pública além do login. |
| 04 | **UUID v7 gerado no aparelho** | Id sequencial no servidor | Cria registros offline sem colisão nem remapeamento. |
| 05 | Outbox drenada pelos **endpoints da proposta** | `POST /sync/push` em lote | Um único caminho de escrita, testável no Postman. |
| 06 | **Pull por cursor** (`change_seq` por *trigger*) | `updatedSince` | Imune a relógio errado; capta inserções feitas direto no banco (passo 9). |
| 07 | **Nginx + systemd** | Docker Compose | A proposta dispensa contêineres. |
| 08 | Atendimento **FINALIZADO é imutável** (correção por adendo) | Edição livre | Prática de prontuário; simplifica conflitos. |
| 09 | **TypeScript como linguagem principal**; Java no identity, Python no document | Java no núcleo | Regras clínicas e validações escritas uma vez para cliente e servidor. |
| 10 | Command envia o **estado mais recente** do registro e coalesce operações | Snapshot por operação | Menos tráfego; edições feitas durante o offline viajam juntas. |
