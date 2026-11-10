-- document-service — e-mails enviados com a ficha e log de acesso.

CREATE TABLE IF NOT EXISTS envio_email (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id      UUID         NOT NULL,
    destinatario_email  VARCHAR(160) NOT NULL,
    status              VARCHAR(10)  NOT NULL CHECK (status IN ('ENVIADO', 'FALHOU')),
    erro                TEXT,
    solicitado_por      UUID         NOT NULL,
    enviado_em          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_log (
    id               BIGSERIAL PRIMARY KEY,
    data_hora        TIMESTAMPTZ   NOT NULL,
    ip_cliente       VARCHAR(64),
    profissional_id  UUID,
    metodo           VARCHAR(10)   NOT NULL,
    rota             VARCHAR(200)  NOT NULL,
    status_code      SMALLINT      NOT NULL,
    tempo_ms         NUMERIC(10,2) NOT NULL
);
