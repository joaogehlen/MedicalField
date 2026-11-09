-- document-service — fichas geradas, envios de e-mail, idempotência e log de acesso.

CREATE TABLE IF NOT EXISTS documento_gerado (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id      UUID         NOT NULL,
    versao_atendimento  INT          NOT NULL,
    sha256              VARCHAR(64)  NOT NULL,
    caminho_arquivo     VARCHAR(500) NOT NULL,
    tamanho_bytes       INT          NOT NULL,
    gerado_por          UUID         NOT NULL,
    gerado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (atendimento_id, versao_atendimento)
);

CREATE TABLE IF NOT EXISTS envio_email (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id        UUID         NOT NULL REFERENCES documento_gerado (id),
    atendimento_id      UUID         NOT NULL,
    destinatario_email  VARCHAR(160) NOT NULL,
    destinatario_nome   VARCHAR(160),
    tipo                VARCHAR(10)  NOT NULL CHECK (tipo IN ('PACIENTE', 'FAMILIAR', 'HOSPITAL')),
    status              VARCHAR(10)  NOT NULL CHECK (status IN ('PENDENTE', 'ENVIADO', 'FALHOU')),
    message_id          VARCHAR(200),
    erro                TEXT,
    solicitado_por      UUID         NOT NULL,
    criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    enviado_em          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_envio_atendimento ON envio_email (atendimento_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS idempotency_key (
    chave        UUID PRIMARY KEY,
    rota         VARCHAR(200) NOT NULL,
    status_http  SMALLINT     NOT NULL,
    resposta     JSONB        NOT NULL,
    criado_em    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_log (
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
CREATE INDEX IF NOT EXISTS ix_access_log_data ON access_log (data_hora DESC);
