-- clinical-service — núcleo clínico: pessoas, prontuários, atendimentos, catálogo e sincronização.

-- Cursor global de sincronização: toda inserção/alteração recebe o próximo valor.
CREATE SEQUENCE change_seq_global;

-- Preenche change_seq, atualizado_em e incrementa version. Por ser trigger, cobre
-- também alterações feitas direto no banco (ex.: medicamento inserido via psql).
CREATE FUNCTION fn_touch_sync() RETURNS trigger AS $$
BEGIN
  NEW.change_seq    := nextval('change_seq_global');
  NEW.atualizado_em := now();
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

/* ------------------------------ Catálogo ---------------------------------- */

CREATE TABLE medicamento (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                    VARCHAR(120)  NOT NULL,
    principio_ativo         VARCHAR(120)  NOT NULL,
    apresentacao            VARCHAR(160)  NOT NULL DEFAULT '',
    unidade                 VARCHAR(20)   NOT NULL,
    vias_permitidas         TEXT[]        NOT NULL,
    dose_maxima_dose        NUMERIC(12,3) NOT NULL,
    dose_maxima_diaria      NUMERIC(12,3),
    intervalo_minimo_horas  SMALLINT,
    controlado              BOOLEAN       NOT NULL DEFAULT FALSE,
    contraindicacoes        TEXT[]        NOT NULL DEFAULT '{}',
    alergenos               TEXT[]        NOT NULL DEFAULT '{}',
    ativo                   BOOLEAN       NOT NULL DEFAULT TRUE,
    version                 INT           NOT NULL DEFAULT 1,
    change_seq              BIGINT        NOT NULL DEFAULT 0,
    criado_em               TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE hospital (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome           VARCHAR(160) NOT NULL,
    cidade         VARCHAR(120) NOT NULL,
    telefone       VARCHAR(30),
    ativo          BOOLEAN      NOT NULL DEFAULT TRUE,
    version        INT          NOT NULL DEFAULT 1,
    change_seq     BIGINT       NOT NULL DEFAULT 0,
    criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE viatura (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefixo        VARCHAR(30)  NOT NULL UNIQUE,
    tipo           VARCHAR(10)  NOT NULL CHECK (tipo IN ('USA', 'USB', 'RESGATE')),
    base           VARCHAR(120) NOT NULL,
    ativo          BOOLEAN      NOT NULL DEFAULT TRUE,
    version        INT          NOT NULL DEFAULT 1,
    change_seq     BIGINT       NOT NULL DEFAULT 0,
    criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

/* ------------------------- Registros clínicos ------------------------------ */

CREATE TABLE pessoa (
    id                     UUID PRIMARY KEY,
    nome                   VARCHAR(160) NOT NULL,
    identificada           BOOLEAN      NOT NULL DEFAULT TRUE,
    cpf                    VARCHAR(11),
    data_nascimento        DATE,
    sexo                   CHAR(1)      CHECK (sexo IN ('M', 'F', 'O')),
    telefone               VARCHAR(30),
    email                  VARCHAR(160),
    contato_nome           VARCHAR(160),
    contato_parentesco     VARCHAR(60),
    contato_telefone       VARCHAR(30),
    contato_email          VARCHAR(160),
    caracteristicas        TEXT,
    mesclada_em            UUID REFERENCES pessoa (id),
    version                INT          NOT NULL DEFAULT 1,
    change_seq             BIGINT       NOT NULL DEFAULT 0,
    atualizado_em_cliente  TIMESTAMPTZ  NOT NULL,
    registrado_por         UUID         NOT NULL,
    sincronizado_por       UUID,
    dispositivo_id         VARCHAR(64)  NOT NULL,
    criado_offline         BOOLEAN      NOT NULL DEFAULT FALSE,
    excluido               BOOLEAN      NOT NULL DEFAULT FALSE,
    criado_em              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_pessoa_cpf ON pessoa (cpf) WHERE cpf IS NOT NULL AND mesclada_em IS NULL;

CREATE TABLE prontuario (
    id                          UUID PRIMARY KEY,
    pessoa_id                   UUID         NOT NULL REFERENCES pessoa (id),
    tipo_sanguineo              VARCHAR(3),
    alergias                    TEXT[]       NOT NULL DEFAULT '{}',
    comorbidades                TEXT[]       NOT NULL DEFAULT '{}',
    medicamentos_uso_continuo   TEXT[]       NOT NULL DEFAULT '{}',
    observacoes                 TEXT,
    mesclado_em                 UUID REFERENCES prontuario (id),
    version                     INT          NOT NULL DEFAULT 1,
    change_seq                  BIGINT       NOT NULL DEFAULT 0,
    atualizado_em_cliente       TIMESTAMPTZ  NOT NULL,
    registrado_por              UUID         NOT NULL,
    sincronizado_por            UUID,
    dispositivo_id              VARCHAR(64)  NOT NULL,
    criado_offline              BOOLEAN      NOT NULL DEFAULT FALSE,
    excluido                    BOOLEAN      NOT NULL DEFAULT FALSE,
    criado_em                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em               TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Um prontuário ativo por pessoa.
CREATE UNIQUE INDEX ux_prontuario_pessoa ON prontuario (pessoa_id) WHERE mesclado_em IS NULL;

CREATE TABLE atendimento (
    id                     UUID PRIMARY KEY,
    pessoa_id              UUID          NOT NULL REFERENCES pessoa (id),
    prontuario_id          UUID          NOT NULL REFERENCES prontuario (id),
    viatura_id             UUID REFERENCES viatura (id),
    hospital_destino_id    UUID REFERENCES hospital (id),
    status                 VARCHAR(12)   NOT NULL CHECK (status IN ('RASCUNHO', 'FINALIZADO')),
    iniciado_em            TIMESTAMPTZ   NOT NULL,
    finalizado_em          TIMESTAMPTZ,
    local_descricao        VARCHAR(300)  NOT NULL,
    latitude               NUMERIC(9,6),
    longitude              NUMERIC(9,6),
    queixa_principal       VARCHAR(300)  NOT NULL,
    descricao              TEXT,
    triagem_protocolo      VARCHAR(12)   NOT NULL CHECK (triagem_protocolo IN ('START', 'MANCHESTER')),
    triagem_classificacao  VARCHAR(10)   NOT NULL,
    glasgow_ocular         SMALLINT      NOT NULL CHECK (glasgow_ocular BETWEEN 1 AND 4),
    glasgow_verbal         SMALLINT      NOT NULL CHECK (glasgow_verbal BETWEEN 1 AND 5),
    glasgow_motora         SMALLINT      NOT NULL CHECK (glasgow_motora BETWEEN 1 AND 6),
    glasgow_total          SMALLINT      NOT NULL CHECK (glasgow_total = glasgow_ocular + glasgow_verbal + glasgow_motora),
    procedimentos          TEXT[]        NOT NULL DEFAULT '{}',
    version                INT           NOT NULL DEFAULT 1,
    change_seq             BIGINT        NOT NULL DEFAULT 0,
    atualizado_em_cliente  TIMESTAMPTZ   NOT NULL,
    registrado_por         UUID          NOT NULL,
    sincronizado_por       UUID,
    sincronizado_em        TIMESTAMPTZ,
    dispositivo_id         VARCHAR(64)   NOT NULL,
    criado_offline         BOOLEAN       NOT NULL DEFAULT FALSE,
    excluido               BOOLEAN       NOT NULL DEFAULT FALSE,
    criado_em              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atualizado_em          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_atendimento_pessoa ON atendimento (pessoa_id);
CREATE INDEX ix_atendimento_inicio ON atendimento (iniciado_em DESC);

-- Itens append-only: cada um tem id próprio gerado no dispositivo.
CREATE TABLE sinal_vital (
    id              UUID PRIMARY KEY,
    atendimento_id  UUID         NOT NULL REFERENCES atendimento (id),
    aferido_em      TIMESTAMPTZ  NOT NULL,
    pa_sistolica    SMALLINT,
    pa_diastolica   SMALLINT,
    fc              SMALLINT,
    fr              SMALLINT,
    spo2            SMALLINT,
    temperatura     NUMERIC(4,1),
    glicemia        SMALLINT,
    dor             SMALLINT
);
CREATE INDEX ix_sinal_vital_atendimento ON sinal_vital (atendimento_id);

CREATE TABLE administracao_medicamento (
    id                 UUID PRIMARY KEY,
    atendimento_id     UUID          NOT NULL REFERENCES atendimento (id),
    medicamento_id     UUID          NOT NULL REFERENCES medicamento (id),
    dose               NUMERIC(12,3) NOT NULL,
    unidade            VARCHAR(20)   NOT NULL,
    via                VARCHAR(12)   NOT NULL,
    administrado_em    TIMESTAMPTZ   NOT NULL,
    administrado_por   UUID          NOT NULL,
    observacao         VARCHAR(500),
    alertas_ignorados  JSONB         NOT NULL DEFAULT '[]'
);
CREATE INDEX ix_administracao_atendimento ON administracao_medicamento (atendimento_id);

CREATE TABLE adendo (
    id              UUID PRIMARY KEY,
    atendimento_id  UUID         NOT NULL REFERENCES atendimento (id),
    texto           TEXT         NOT NULL,
    autor_id        UUID         NOT NULL,
    criado_em       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_medicamento_sync BEFORE INSERT OR UPDATE ON medicamento FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_hospital_sync    BEFORE INSERT OR UPDATE ON hospital    FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_viatura_sync     BEFORE INSERT OR UPDATE ON viatura     FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_pessoa_sync      BEFORE INSERT OR UPDATE ON pessoa      FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_prontuario_sync  BEFORE INSERT OR UPDATE ON prontuario  FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();
CREATE TRIGGER trg_atendimento_sync BEFORE INSERT OR UPDATE ON atendimento FOR EACH ROW EXECUTE FUNCTION fn_touch_sync();

CREATE INDEX ix_medicamento_seq ON medicamento (change_seq);
CREATE INDEX ix_hospital_seq    ON hospital (change_seq);
CREATE INDEX ix_viatura_seq     ON viatura (change_seq);
CREATE INDEX ix_pessoa_seq      ON pessoa (change_seq);
CREATE INDEX ix_prontuario_seq  ON prontuario (change_seq);
CREATE INDEX ix_atendimento_seq ON atendimento (change_seq);

/* ---------------------- Sincronização e auditoria -------------------------- */

-- Idempotência: resposta original de cada operação (Idempotency-Key), devolvida em reenvios.
CREATE TABLE processed_operation (
    op_id            UUID PRIMARY KEY,
    rota             VARCHAR(200) NOT NULL,
    entidade         VARCHAR(20)  NOT NULL,
    entidade_id      UUID         NOT NULL,
    dispositivo_id   VARCHAR(64),
    profissional_id  UUID         NOT NULL,
    status_http      SMALLINT     NOT NULL,
    resposta         JSONB        NOT NULL,
    processado_em    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE sync_conflito (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    op_id                UUID,
    entidade             VARCHAR(20)  NOT NULL,
    entidade_id          UUID         NOT NULL,
    estrategia           VARCHAR(30)  NOT NULL,
    versao_servidor      INT          NOT NULL,
    versao_base_cliente  INT,
    valor_servidor       JSONB        NOT NULL,
    valor_recebido       JSONB        NOT NULL,
    valor_resultante     JSONB        NOT NULL,
    offset_relogio_ms    BIGINT,
    dispositivo_id       VARCHAR(64),
    profissional_id      UUID,
    resolvido_em         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_sync_conflito_data ON sync_conflito (resolvido_em DESC);

CREATE TABLE access_log (
    id               BIGSERIAL PRIMARY KEY,
    data_hora        TIMESTAMPTZ   NOT NULL,
    request_id       VARCHAR(64),
    ip_cliente       VARCHAR(64),
    profissional_id  UUID,
    metodo           VARCHAR(10)   NOT NULL,
    rota             VARCHAR(200)  NOT NULL,
    caminho          VARCHAR(500)  NOT NULL,
    status_code      SMALLINT      NOT NULL,
    tempo_ms         NUMERIC(10,2) NOT NULL,
    user_agent       VARCHAR(300)
);
CREATE INDEX ix_access_log_data ON access_log (data_hora DESC);
CREATE INDEX ix_access_log_profissional ON access_log (profissional_id);
