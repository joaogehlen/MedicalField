package br.univates.medicalfield.identity.infra;

import jakarta.servlet.http.HttpServletRequest;

/** IP real do cliente: primeiro endereço de X-Forwarded-For (definido pelo Nginx) ou o do socket. */
public final class ClientIp {

    private ClientIp() {}

    public static String of(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
