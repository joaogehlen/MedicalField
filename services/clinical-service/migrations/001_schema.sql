-- clinical-service — pessoas, prontuários, atendimentos, catálogo de medicamentos e sincronização.

-- Cursor global de sincronização: cada inserção/alteração recebe o próximo valor.
CREATE SEQUENCE change_seq_global;

-- Preenche change_seq e incrementa version. Por ser trigger, vale também para
-- alterações feitas direto no banco (ex.: medicamento inserido via psql).
CREATE FUNCTION fn_touch_sync() RETURNS trigger AS $$
BEGIN
  NEW.change_seq := nextval('change_seq_global');
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TABLE medicamento (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             VARCHAR(120)  NOT NULL,
    apresentacao     VARCHAR(160)  NOT NULL DEFAULT '',
    unidade          VARCHAR(20)   NOT NULL,
    vias_permitidas  TEXT[]        NOT NULL,
    dose_maxima      NUMERIC(12,3) NOT NULL,
    alergenos        TEXT[]        NOT NULL DEFAULT '{}',
    ativo            BOOLEAN       NOT NULL DEFAULT TRUE,
    version          INT           NOT NULL DEFAULT 1,
    change_seq       BIGINT        NOT NULL DEFAULT 0
);

CREATE TABLE pessoa (
    id                     UUID PRIMARY KEY,
    nome                   VARCHAR(160) NOT NULL,
    cpf                    VARCHAR(11) UNIQUE,
    data_nascimento        DATE,
    sexo                   CHAR(1) CHECK (sexo IN ('M', 'F', 'O')),
    telefone               VARCHAR(30),
    email                  VARCHAR(160),
    contato_nome           VARCHAR(160),
    contato_email          VARCHAR(160),
    version                INT          NOT NULL DEFAULT 1,
    change_seq             BIGINT       NOT NULL DEFAULT 0,
    atualizado_em_cliente  TIMESTAMPTZ  NOT NULL,
    registrado_por         UUID         NOT NULL,
    dispositivo_id         VARCHAR(64)  NOT NULL,
    criado_offline         BOOLEAN      NOT NULL DEFAULT FALSE,
    sincronizado_em        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE prontuario (
    id                     UUID PRIMARY KEY,
    pessoa_id              UUID         NOT NULL UNIQUE REFERENCES pessoa (id),
    tipo_sanguineo         VARCHAR(3),
    alergias               TEXT[]       NOT NULL DEFAULT '{}',
    comorbidades           TEXT[]       NOT NULL DEFAULT '{}',
    observacoes            TEXT,
    version                INT          NOT NULL DEFAULT 1,
    change_seq             BIGINT       NOT NULL DEFAULT 0,
    atualizado_em_cliente  TIMESTAMPTZ  NOT NULL,
    registrado_por         UUID         NOT NULL,
    dispositivo_id         VARCHAR(64)  NOT NULL,
    criado_offline         BOOLEAN      NOT NULL DEFAULT FALSE,
    sincronizado_em        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE atendimento (
    id                     UUID PRIMARY KEY,
    pessoa_id              UUID          NOT NULL REFERENCES pessoa (id),
    prontuario_id          UUID          NOT NULL REFERENCES prontuario (id),
    data_hora              TIMESTAMPTZ   NOT NULL,
    local                  VARCHAR(300)  NOT NULL,
    queixa_principal       VARCHAR(300)  NOT NULL,
    observacoes            TEXT,
    triagem_protocolo      VARCHAR(12)   NOT NULL CHECK (triagem_protocolo IN ('START', 'MANCHESTER')),
    triagem_classificacao  VARCHAR(10)   NOT NULL,
    glasgow_ocular         SMALLINT      NOT NULL CHECK (glasgow_ocular BETWEEN 1 AND 4),
    glasgow_verbal         SMALLINT      NOT NULL CHECK (glasgow_verbal BETWEEN 1 AND 5),
    glasgow_motora         SMALLINT      NOT NULL CHECK (glasgow_motora BETWEEN 1 AND 6),
    glasgow_total          SMALLINT      NOT NULL CHECK (glasgow_total = glasgow_ocular + glasgow_verbal + glasgow_motora),
    pa_sistolica           SMALLINT,
    pa_diastolica          SMALLINT,
    fc                     SMALLINT,
    fr                     SMALLINT,
    spo2                   SMALLINT,
    temperatura            NUMERIC(4,1),
    glicemia               SMALLINT,
    profissional_nome      VARCHAR(200)  NOT NULL,
    version                INT           NOT NULL DEFAULT 1,
    change_seq             BIGINT        NOT NULL DEFAULT 0,
    atualizado_em_cliente  TIMESTAMPTZ   NOT NULL,
    registrado_por         UUID          NOT NULL,
    dispositivo_id         VARCHAR(64)   NOT NULL,
    criado_offline         BOOLEAN       NOT NULL DEFAULT FALSE,
    sincronizado_em        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_atendimento_pessoa ON atendimento (pessoa_id);

CREATE TABLE medicamento_administrado (
    id              UUID PRIMARY KEY,
    atendimento_id  UUID          NOT NULL REFERENCES atendimento (id),
    medicamento_id  UUID          NOT NULL REFERENCES medicamento (id),
    dose            NUMERIC(12,3) NOT NULL,
    via             VARCHAR(12)   NOT NULL,
    horario         TIMESTAMPTZ   NOT NULL
);

CREATE TRIGGER trg_medicamento_sync BEFORE INSERT OR UPDATE ON medicamento FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_pessoa_sync      BEFORE INSERT OR UPDATE ON pessoa      FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_prontuario_sync  BEFORE INSERT OR UPDATE ON prontuario  FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_atendimento_sync BEFORE INSERT OR UPDATE ON atendimento FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();

-- Idempotência: resposta original de cada Idempotency-Key, devolvida em reenvios.
CREATE TABLE processed_operation (
    op_id          UUID PRIMARY KEY,
    status_http    SMALLINT     NOT NULL,
    resposta       JSONB        NOT NULL,
    processado_em  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Conflitos resolvidos na sincronização (rastreabilidade).
CREATE TABLE sync_conflito (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade          VARCHAR(20)  NOT NULL,
    entidade_id       UUID         NOT NULL,
    estrategia        VARCHAR(20)  NOT NULL,
    valor_servidor    JSONB        NOT NULL,
    valor_recebido    JSONB        NOT NULL,
    valor_resultante  JSONB        NOT NULL,
    resolvido_em      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Log de acesso de cada requisição HTTP (LGPD).
CREATE TABLE access_log (
    id               BIGSERIAL PRIMARY KEY,
    data_hora        TIMESTAMPTZ   NOT NULL,
    ip_cliente       VARCHAR(64),
    profissional_id  UUID,
    metodo           VARCHAR(10)   NOT NULL,
    rota             VARCHAR(200)  NOT NULL,
    status_code      SMALLINT      NOT NULL,
    tempo_ms         NUMERIC(10,2) NOT NULL
);
