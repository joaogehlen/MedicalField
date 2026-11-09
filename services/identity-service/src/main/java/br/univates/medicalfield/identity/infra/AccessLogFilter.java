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
 * Interceptor de auditoria (LGPD): registra toda requisição HTTP com data/hora, IP do
 * cliente, profissional autenticado, método, rota, status e tempo de processamento.
 * Roda antes do Spring Security para registrar também os 401/403.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AccessLogFilter extends OncePerRequestFilter {

    public static final String ATTR_PROFISSIONAL = "mf.profissionalId";
    public static final String ATTR_REQUEST_ID = "mf.requestId";

    private final AccessLogWriter writer;

    public AccessLogFilter(AccessLogWriter writer) {
        this.writer = writer;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long inicio = System.nanoTime();
        OffsetDateTime dataHora = OffsetDateTime.now(ZoneOffset.UTC);
        String requestId = req.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank() || requestId.length() > 64) {
            requestId = UUID.randomUUID().toString();
        }
        req.setAttribute(ATTR_REQUEST_ID, requestId);
        res.setHeader("X-Request-Id", requestId);
        try {
            chain.doFilter(req, res);
        } finally {
            double ms = (System.nanoTime() - inicio) / 1_000_000.0;
            Object padrao = req.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
            Object prof = req.getAttribute(ATTR_PROFISSIONAL);
            writer.registrar(new AccessLogWriter.Entrada(
                    dataHora,
                    requestId,
                    ClientIp.of(req),
                    prof instanceof UUID u ? u : null,
                    req.getMethod(),
                    padrao != null ? padrao.toString() : req.getRequestURI(),
                    req.getRequestURI(),
                    res.getStatus(),
                    Math.round(ms * 100.0) / 100.0,
                    req.getHeader("User-Agent")));
        }
    }
}
