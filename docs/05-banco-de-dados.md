# 05 — Modelagem dos Bancos de Dados (Entregável E2, parte 2)

Persistência dual: **PostgreSQL 16** na VM (central) e **IndexedDB/Dexie** no aparelho (embarcado).

## 1. Banco central

| Schema | Usuário | Migração | Tabelas |
|---|---|---|---|
| `identity` | `mf_identity` | Flyway (`services/identity-service/src/main/resources/db/migration`) | `profissional`, `refresh_token`, `log_cliente`, `idempotency_key`, `access_log` |
| `clinical` | `mf_clinical` | `services/clinical-service/migrations/*.sql` | `pessoa`, `prontuario`, `atendimento`, `sinal_vital`, `administracao_medicamento`, `adendo`, `medicamento`, `hospital`, `viatura`, `processed_operation`, `sync_conflito`, `access_log` |
| `document` | `mf_document` | `services/document-service/migrations/001_schema.sql` | `documento_gerado`, `envio_email`, `idempotency_key`, `access_log` |

Criação de banco, usuários e *schemas*: `infra/db/init.sql`. Cada usuário só acessa o próprio *schema*. Referências entre serviços (ex.: `registrado_por` → profissional) são lógicas, sem chave estrangeira física.

### Colunas de sincronização (`clinical`)

| Coluna | Finalidade |
|---|---|
| `id UUID` | gerado no aparelho (v7) |
| `version INT` | controle otimista; incrementado pelo *trigger* |
| `change_seq BIGINT` | cursor global de sincronização (*trigger*) |
| `atualizado_em_cliente` | hora clínica informada no aparelho (usada no LWW) |
| `registrado_por` / `sincronizado_por` | quem registrou × quem enviou |
| `dispositivo_id`, `criado_offline` | origem do registro |
| `mesclada_em` / `mesclado_em` | duplicata apontando para o registro canônico |

```sql
CREATE SEQUENCE change_seq_global;
CREATE FUNCTION fn_touch_sync() RETURNS trigger AS $$
BEGIN
  NEW.change_seq    := nextval('change_seq_global');
  NEW.atualizado_em := now();
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN NEW.version := OLD.version + 1; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
-- aplicado (BEFORE INSERT OR UPDATE) em medicamento, hospital, viatura, pessoa, prontuario, atendimento
```

## 2. Diagrama ER — `clinical`

```mermaid
erDiagram
    PESSOA ||--o| PRONTUARIO : "possui"
    PESSOA ||--o{ ATENDIMENTO : "recebe"
    PRONTUARIO ||--o{ ATENDIMENTO : "registra"
    ATENDIMENTO ||--o{ SINAL_VITAL : "afere"
    ATENDIMENTO ||--o{ ADMINISTRACAO_MEDICAMENTO : "administra"
    ATENDIMENTO ||--o{ ADENDO : "corrige"
    MEDICAMENTO ||--o{ ADMINISTRACAO_MEDICAMENTO : "usado em"
    HOSPITAL ||--o{ ATENDIMENTO : "destino"
    VIATURA ||--o{ ATENDIMENTO : "atende"

    PESSOA {
        uuid id PK
        varchar nome
        boolean identificada
        varchar cpf "único entre não mescladas"
        date data_nascimento
        char sexo
        varchar telefone
        varchar email
        varchar contato_nome
        varchar contato_parentesco
        varchar contato_telefone
        varchar contato_email
        text caracteristicas
        uuid mesclada_em FK
        int version
        bigint change_seq
    }
    PRONTUARIO {
        uuid id PK
        uuid pessoa_id FK
        varchar tipo_sanguineo
        text_array alergias
        text_array comorbidades
        text_array medicamentos_uso_continuo
        text observacoes
        uuid mesclado_em FK
        int version
        bigint change_seq
    }
    ATENDIMENTO {
        uuid id PK
        uuid pessoa_id FK
        uuid prontuario_id FK
        uuid viatura_id FK
        uuid hospital_destino_id FK
        varchar status "RASCUNHO | FINALIZADO"
        timestamptz iniciado_em
        timestamptz finalizado_em
        varchar local_descricao
        numeric latitude
        numeric longitude
        varchar queixa_principal
        text descricao
        varchar triagem_protocolo "START | MANCHESTER"
        varchar triagem_classificacao
        smallint glasgow_ocular
        smallint glasgow_verbal
        smallint glasgow_motora
        smallint glasgow_total
        text_array procedimentos
        uuid registrado_por
        uuid sincronizado_por
        timestamptz sincronizado_em
        boolean criado_offline
        int version
        bigint change_seq
    }
    SINAL_VITAL {
        uuid id PK
        uuid atendimento_id FK
        timestamptz aferido_em
        smallint pa_sistolica
        smallint pa_diastolica
        smallint fc
        smallint fr
        smallint spo2
        numeric temperatura
        smallint glicemia
        smallint dor
    }
    ADMINISTRACAO_MEDICAMENTO {
        uuid id PK
        uuid atendimento_id FK
        uuid medicamento_id FK
        numeric dose
        varchar unidade
        varchar via
        timestamptz administrado_em
        uuid administrado_por
        varchar observacao
        jsonb alertas_ignorados
    }
    ADENDO {
        uuid id PK
        uuid atendimento_id FK
        text texto
        uuid autor_id
        timestamptz criado_em
    }
    MEDICAMENTO {
        uuid id PK
        varchar nome
        varchar principio_ativo
        varchar apresentacao
        varchar unidade
        text_array vias_permitidas
        numeric dose_maxima_dose
        numeric dose_maxima_diaria
        smallint intervalo_minimo_horas
        boolean controlado
        text_array alergenos
        boolean ativo
        bigint change_seq
    }
    HOSPITAL {
        uuid id PK
        varchar nome
        varchar cidade
        varchar telefone
        boolean ativo
    }
    VIATURA {
        uuid id PK
        varchar prefixo
        varchar tipo "USA | USB | RESGATE"
        varchar base
        boolean ativo
    }
```

### Sincronização e auditoria (`clinical`)

```mermaid
erDiagram
    PROCESSED_OPERATION {
        uuid op_id PK "Idempotency-Key"
        varchar rota
        varchar entidade
        uuid entidade_id
        varchar dispositivo_id
        uuid profissional_id
        smallint status_http
        jsonb resposta "devolvida no replay"
        timestamptz processado_em
    }
    SYNC_CONFLITO {
        uuid id PK
        uuid op_id
        varchar entidade
        uuid entidade_id
        varchar estrategia "LWW | FIELD_MERGE | UNION | SERVER_WINS"
        int versao_servidor
        int versao_base_cliente
        jsonb valor_servidor
        jsonb valor_recebido
        jsonb valor_resultante
        bigint offset_relogio_ms
        timestamptz resolvido_em
    }
    ACCESS_LOG {
        bigserial id PK
        timestamptz data_hora
        varchar request_id
        varchar ip_cliente
        uuid profissional_id
        varchar metodo
        varchar rota
        varchar caminho
        smallint status_code
        numeric tempo_ms
        varchar user_agent
    }
```

## 3. Schema `identity`

```mermaid
erDiagram
    PROFISSIONAL ||--o{ REFRESH_TOKEN : possui
    PROFISSIONAL {
        uuid id PK
        varchar nome
        varchar tipo_registro "CRM | COREN | SOCORRISTA"
        varchar numero_registro
        char uf
        varchar papel "MEDICO | ENFERMEIRO | SOCORRISTA | ADMIN"
        varchar email
        varchar senha_hash "argon2id"
        smallint tentativas_falhas
        timestamptz bloqueado_ate
        boolean ativo
    }
    REFRESH_TOKEN {
        uuid id PK
        uuid profissional_id FK
        varchar token_hash "SHA-256"
        varchar dispositivo_id
        timestamptz expira_em
        timestamptz revogado_em
    }
    LOG_CLIENTE {
        uuid id PK "gerado no aparelho"
        varchar dispositivo_id
        uuid profissional_id
        timestamptz data_hora
        varchar nivel
        varchar acao
        varchar entidade
        varchar entidade_id
        jsonb detalhes
        uuid enviado_por
        timestamptz recebido_em
    }
    IDEMPOTENCY_KEY {
        uuid chave PK
        varchar rota
        smallint status_http
        jsonb resposta
    }
```
Índice único `(tipo_registro, numero_registro, COALESCE(uf,''))`. `access_log` igual ao do `clinical`.

## 4. Schema `document`

```mermaid
erDiagram
    DOCUMENTO_GERADO ||--o{ ENVIO_EMAIL : anexado
    DOCUMENTO_GERADO {
        uuid id PK
        uuid atendimento_id
        int versao_atendimento "único com atendimento_id"
        varchar sha256
        varchar caminho_arquivo
        int tamanho_bytes
        uuid gerado_por
        timestamptz gerado_em
    }
    ENVIO_EMAIL {
        uuid id PK
        uuid documento_id FK
        uuid atendimento_id
        varchar destinatario_email
        varchar destinatario_nome
        varchar tipo "PACIENTE | FAMILIAR | HOSPITAL"
        varchar status "PENDENTE | ENVIADO | FALHOU"
        varchar message_id
        text erro
        uuid solicitado_por
        timestamptz criado_em
        timestamptz enviado_em
    }
```
Mais `idempotency_key` e `access_log`. Os PDFs ficam em `FICHAS_DIR` e são reaproveitados enquanto a versão do atendimento não muda.

## 5. Banco embarcado — IndexedDB (Dexie)

`apps/client/src/data/db.ts`. No aparelho, sinais vitais e medicamentos ficam dentro do documento do atendimento; o servidor normaliza.

```ts
this.version(1).stores({
  pessoas:      'id, cpf, nome, syncStatus, mescladaEm',
  prontuarios:  'id, pessoaId, syncStatus',
  atendimentos: 'id, pessoaId, prontuarioId, status, syncStatus, iniciadoEm',
  medicamentos: 'id, nome, ativo',
  hospitais:    'id, nome',
  viaturas:     'id, prefixo',
  outbox:       '++seq, &opId, status, tipo, entidadeId',
  logsLocais:   'id, enviado, dataHora',
  credenciais:  'chave',   // login offline: salt + hash PBKDF2 + perfil
  meta:         'chave',   // syncCursor, ultimaSync, ultimoRecebimento
});
```

| Tabela | Conteúdo | Estado |
|---|---|---|
| `pessoas`, `prontuarios`, `atendimentos` | registros do aparelho e recebidos | `syncStatus`: `PENDENTE` · `SINCRONIZADO` · `ERRO` |
| `medicamentos`, `hospitais`, `viaturas` | cache dos cadastros (regras clínicas offline) | — |
| `outbox` | Commands a enviar | `PENDENTE` · `ENVIANDO` · `CONCLUIDO` · `ERRO` |
| `logsLocais` | ações para `POST /log` | `enviado` 0/1 |

## 6. Dados de demonstração

- **identity:** 4 profissionais com ids fixos — Central de Regulação (`SOCORRISTA 0001`, ADMIN), Dra. Ana Souza (`CRM 12345/RS`), Enf. Bruno Lima (`COREN 54321/RS`), Carla Mendes (`SOCORRISTA 2048`). Senha: `MEDICALFIELD_SEED_SENHA` (padrão `medicalfield`).
- **clinical** (`seeds/demo.sql`): 10 medicamentos, 3 hospitais, 2 viaturas, 2 pacientes com prontuário e 1 atendimento cada.
- **Passo 9:** `infra/db/roteiro/passo-09-novos-medicamentos.sql` insere Cetoprofeno e Salbutamol.

Todos os pacientes, CPFs, telefones e e-mails são **fictícios**.
