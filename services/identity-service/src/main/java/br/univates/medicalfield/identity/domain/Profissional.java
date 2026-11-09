package br.univates.medicalfield.identity.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Linha da tabela profissional, incluindo dados sensíveis que nunca saem do serviço. */
public record Profissional(
        UUID id,
        String nome,
        TipoRegistro tipoRegistro,
        String numeroRegistro,
        String uf,
        Papel papel,
        String email,
        String senhaHash,
        int tentativasFalhas,
        OffsetDateTime bloqueadoAte,
        boolean ativo) {

    /** Identificação legível do registro profissional, ex.: "CRM 12345/RS". */
    public String registro() {
        return uf == null || uf.isBlank()
                ? tipoRegistro + " " + numeroRegistro
                : tipoRegistro + " " + numeroRegistro + "/" + uf;
    }
}
