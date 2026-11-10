-- identity-service — profissionais, logs enviados pelos aparelhos e log de acesso.

CREATE TABLE profissional (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             VARCHAR(160) NOT NULL,
    tipo_registro    VARCHAR(12)  NOT NULL CHECK (tipo_registro IN ('CRM', 'COREN', 'SOCORRISTA')),
    numero_registro  VARCHAR(20)  NOT NULL,
    uf               CHAR(2),
    papel            VARCHAR(12)  NOT NULL CHECK (papel IN ('MEDICO', 'ENFERMEIRO', 'SOCORRISTA', 'ADMIN')),
    email            VARCHAR(160),
    senha_hash       VARCHAR(255) NOT NULL,
    ativo            BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX ux_profissional_registro ON profissional (tipo_registro, numero_registro, COALESCE(uf, ''));

-- Logs gerados no aparelho (inclusive offline). O id vem do aparelho: reenvio não duplica.
CREATE TABLE log_cliente (
    id               UUID PRIMARY KEY,
    dispositivo_id   VARCHAR(64)  NOT NULL,
    profissional_id  UUID,
    data_hora        TIMESTAMPTZ  NOT NULL,
    acao             VARCHAR(40)  NOT NULL,
    detalhes         JSONB,
    recebido_em      TIMESTAMPTZ  NOT NULL DEFAULT now()
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
