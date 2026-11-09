-- identity-service — profissionais, tokens de atualização, logs offline do cliente e auditoria de acesso.

CREATE TABLE profissional (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome               VARCHAR(160) NOT NULL,
    tipo_registro      VARCHAR(12)  NOT NULL CHECK (tipo_registro IN ('CRM', 'COREN', 'SOCORRISTA')),
    numero_registro    VARCHAR(20)  NOT NULL,
    uf                 CHAR(2),
    papel              VARCHAR(12)  NOT NULL CHECK (papel IN ('MEDICO', 'ENFERMEIRO', 'SOCORRISTA', 'ADMIN')),
    email              VARCHAR(160),
    senha_hash         VARCHAR(255) NOT NULL,
    tentativas_falhas  SMALLINT     NOT NULL DEFAULT 0,
    bloqueado_ate      TIMESTAMPTZ,
    ativo              BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_em          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_profissional_registro ON profissional (tipo_registro, numero_registro, COALESCE(uf, ''));

CREATE TABLE refresh_token (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id  UUID        NOT NULL REFERENCES profissional (id),
    token_hash       VARCHAR(64) NOT NULL UNIQUE,
    dispositivo_id   VARCHAR(64),
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em        TIMESTAMPTZ NOT NULL,
    revogado_em      TIMESTAMPTZ
);

-- Logs gerados no dispositivo (inclusive offline). O id vem do cliente: reenvio não duplica.
CREATE TABLE log_cliente (
    id               UUID PRIMARY KEY,
    dispositivo_id   VARCHAR(64)  NOT NULL,
    profissional_id  UUID,
    data_hora        TIMESTAMPTZ  NOT NULL,
    nivel            VARCHAR(5)   NOT NULL,
    acao             VARCHAR(40)  NOT NULL,
    entidade         VARCHAR(40),
    entidade_id      VARCHAR(64),
    detalhes         JSONB,
    enviado_por      UUID         NOT NULL,
    recebido_em      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_log_cliente_data ON log_cliente (data_hora DESC);

CREATE TABLE idempotency_key (
    chave        UUID PRIMARY KEY,
    rota         VARCHAR(200) NOT NULL,
    status_http  SMALLINT     NOT NULL,
    resposta     JSONB        NOT NULL,
    criado_em    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Log de acesso de cada requisição HTTP (LGPD).
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
