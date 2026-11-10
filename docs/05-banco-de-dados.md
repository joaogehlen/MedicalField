# 05 — Modelagem dos Bancos de Dados (Entregável E2, parte 2)

Persistência dual: **PostgreSQL 16** na VM (central) e **IndexedDB/Dexie** no aparelho (embarcado).

## 1. Banco central

| Schema | Usuário | Migração | Tabelas |
|---|---|---|---|
| `identity` | `mf_identity` | Flyway (`services/identity-service/src/main/resources/db/migration`) | `profissional`, `log_cliente`, `access_log` |
| `clinical` | `mf_clinical` | `services/clinical-service/migrations/001_schema.sql` | `pessoa`, `prontuario`, `atendimento`, `medicamento_administrado`, `medicamento`, `processed_operation`, `sync_conflito`, `access_log` |
| `document` | `mf_document` | `services/document-service/migrations/001_schema.sql` | `envio_email`, `access_log` |

Banco, usuários e *schemas*: `infra/db/init.sql`. Cada usuário só acessa o próprio *schema*. Referências entre serviços (ex.: `registrado_por` → profissional) são lógicas, sem chave estrangeira.

### Colunas de sincronização (`clinical`)

| Coluna | Finalidade |
|---|---|
| `id UUID` | gerado no aparelho (v7) |
| `version INT` | versão do registro; incrementada pelo *trigger* |
| `change_seq BIGINT` | cursor global de sincronização (*trigger*) |
| `atualizado_em_cliente` | hora da edição no aparelho (usada no Last-Write-Wins) |
| `registrado_por`, `dispositivo_id`, `criado_offline` | quem registrou, em qual aparelho, e se foi sem rede |
| `sincronizado_em` | quando chegou à central |

```sql
CREATE SEQUENCE change_seq_global;
CREATE FUNCTION fn_touch_sync() RETURNS trigger AS $$
BEGIN
  NEW.change_seq := nextval('change_seq_global');
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
-- BEFORE INSERT OR UPDATE em medicamento, pessoa, prontuario e atendimento
```

### Modelo clínico

```mermaid
erDiagram
    PESSOA ||--o| PRONTUARIO : "tem"
    PESSOA ||--o{ ATENDIMENTO : "recebe"
    PRONTUARIO ||--o{ ATENDIMENTO : "registra"
    ATENDIMENTO ||--o{ MEDICAMENTO_ADMINISTRADO : "inclui"
    MEDICAMENTO ||--o{ MEDICAMENTO_ADMINISTRADO : "é usado em"
    PESSOA {
        uuid id PK
        varchar nome
        varchar cpf UK
        date data_nascimento
        char sexo
        varchar telefone
        varchar email
        varchar contato_nome
        varchar contato_email
    }
    PRONTUARIO {
        uuid id PK
        uuid pessoa_id FK "UNIQUE"
        varchar tipo_sanguineo
        text_array alergias
        text_array comorbidades
        text observacoes
    }
    ATENDIMENTO {
        uuid id PK
        uuid pessoa_id FK
        uuid prontuario_id FK
        timestamptz data_hora
        varchar local
        varchar queixa_principal
        varchar triagem_protocolo "START | MANCHESTER"
        varchar triagem_classificacao
        smallint glasgow_ocular
        smallint glasgow_verbal
        smallint glasgow_motora
        smallint glasgow_total
        smallint pa_sistolica
        smallint pa_diastolica
        smallint fc
        smallint fr
        smallint spo2
        numeric temperatura
        smallint glicemia
        varchar profissional_nome
    }
    MEDICAMENTO_ADMINISTRADO {
        uuid id PK
        uuid atendimento_id FK
        uuid medicamento_id FK
        numeric dose
        varchar via
        timestamptz horario
    }
    MEDICAMENTO {
        uuid id PK
        varchar nome
        varchar apresentacao
        varchar unidade
        text_array vias_permitidas
        numeric dose_maxima
        text_array alergenos
        boolean ativo
    }
```

### Sincronização (`clinical`)

| Tabela | Uso |
|---|---|
| `processed_operation` | `op_id` (Idempotency-Key) → status e resposta gravados; reenvio devolve a mesma resposta |
| `sync_conflito` | entidade, estratégia, valor do servidor, valor recebido e resultado de cada conflito |

### Identidade e documentos

```mermaid
erDiagram
    PROFISSIONAL ||--o{ LOG_CLIENTE : "gera"
    PROFISSIONAL {
        uuid id PK
        varchar nome
        varchar tipo_registro "CRM | COREN | SOCORRISTA"
        varchar numero_registro
        char uf
        varchar papel "MEDICO | ENFERMEIRO | SOCORRISTA | ADMIN"
        varchar senha_hash "argon2id"
        boolean ativo
    }
    LOG_CLIENTE {
        uuid id PK "gerado no aparelho"
        varchar dispositivo_id
        uuid profissional_id
        timestamptz data_hora
        varchar acao
        jsonb detalhes
    }
    ENVIO_EMAIL {
        uuid id PK
        uuid atendimento_id
        varchar destinatario_email
        varchar status "ENVIADO | FALHOU"
        uuid solicitado_por
        timestamptz enviado_em
    }
```

### Log de acesso (os três *schemas*)

`access_log(id, data_hora, ip_cliente, profissional_id, metodo, rota, status_code, tempo_ms)` — uma linha por requisição.

## 2. Banco do aparelho (IndexedDB / Dexie)

`apps/client/src/data/db.ts`. No aparelho, sinais vitais e medicamentos ficam dentro do documento do atendimento.

```ts
this.version(1).stores({
  pessoas:      'id, nome',
  prontuarios:  'id, pessoaId',
  atendimentos: 'id, pessoaId, dataHora',
  medicamentos: 'id, nome',
  outbox:       '++seq, status, entidadeId',
  logsLocais:   'id, enviado',
  meta:         'chave',          // cursor, último envio/recebimento
});
```

| Tabela | Conteúdo |
|---|---|
| `pessoas`, `prontuarios`, `atendimentos` | registros com `syncStatus` (`PENDENTE`, `SINCRONIZADO`, `ERRO`) |
| `medicamentos` | catálogo (as regras clínicas funcionam offline) |
| `outbox` | operações a enviar ([03 §3](03-sincronizacao-offline.md#3-outbox-command)) |
| `logsLocais` | logs do aparelho ainda não enviados |
| `meta` | cursor de recebimento e datas da última sincronização |

## 3. Dados de demonstração

- **identity** (`SeedRunner`): 4 profissionais — ADMIN `SOCORRISTA 0001`, Dra. Ana Souza `CRM 12345/RS`, Enf. Bruno Lima `COREN 54321/RS`, Carla Mendes `SOCORRISTA 2048`. Senha de todos: `medicalfield`.
- **clinical** (`seeds/demo.sql`): 8 medicamentos, 2 pacientes com prontuário (João Pedro tem alergia a Dipirona) e 2 atendimentos.
- **Passo 9 do roteiro**: `infra/db/roteiro/passo-09-novos-medicamentos.sql` insere Cetoprofeno e Salbutamol direto no banco.
