package br.univates.medicalfield.identity.infra;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Interceptor de log de acesso (LGPD): data/hora, IP do cliente, profissional
 * autenticado, método, rota, status e tempo de processamento de cada requisição.
 * Roda antes do Spring Security para registrar também os 401.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AccessLogFilter extends OncePerRequestFilter {

    public static final String ATTR_PROFISSIONAL = "mf.profissionalId";

    private final AccessLogWriter writer;

    public AccessLogFilter(AccessLogWriter writer) {
        this.writer = writer;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long inicio = System.nanoTime();
        OffsetDateTime dataHora = OffsetDateTime.now(ZoneOffset.UTC);
        try {
            chain.doFilter(req, res);
        } finally {
            Object rota = req.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
            Object prof = req.getAttribute(ATTR_PROFISSIONAL);
            String xff = req.getHeader("X-Forwarded-For");
            writer.registrar(new AccessLogWriter.Entrada(
                    dataHora,
                    xff != null && !xff.isBlank() ? xff.split(",")[0].trim() : req.getRemoteAddr(),
                    prof instanceof UUID u ? u : null,
                    req.getMethod(),
                    rota != null ? rota.toString() : req.getRequestURI(),
                    res.getStatus(),
                    Math.round((System.nanoTime() - inicio) / 10_000.0) / 100.0));
        }
    }
}
