package br.univates.medicalfield.identity.domain;

import java.util.UUID;

/** Linha da tabela profissional (o hash da senha nunca sai do serviço). */
public record Profissional(
        UUID id,
        String nome,
        TipoRegistro tipoRegistro,
        String numeroRegistro,
        String uf,
        Papel papel,
        String email,
        String senhaHash,
        boolean ativo) {

    /** Ex.: "CRM 12345/RS". */
    public String registro() {
        return uf == null || uf.isBlank()
                ? tipoRegistro + " " + numeroRegistro
                : tipoRegistro + " " + numeroRegistro + "/" + uf;
    }
}
