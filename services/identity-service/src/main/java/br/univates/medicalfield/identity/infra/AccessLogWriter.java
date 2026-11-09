package br.univates.medicalfield.identity.infra;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Grava o log de acesso de forma assíncrona: a requisição só enfileira; um agendador
 * persiste em lote. Cada entrada também vai para o stdout em JSON (journald), de modo
 * que nada se perde se o banco estiver indisponível.
 */
@Component
public class AccessLogWriter {

    public record Entrada(OffsetDateTime dataHora, String requestId, String ipCliente, UUID profissionalId,
                          String metodo, String rota, String caminho, int statusCode, double tempoMs,
                          String userAgent) {}

    private static final Logger log = LoggerFactory.getLogger("access-log");
    private static final int MAX_FILA = 10_000;

    private final LinkedBlockingQueue<Entrada> fila = new LinkedBlockingQueue<>(MAX_FILA);
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public AccessLogWriter(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void registrar(Entrada e) {
        try {
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("servico", "identity-service");
            linha.put("data_hora", e.dataHora().toString());
            linha.put("request_id", e.requestId());
            linha.put("ip_cliente", e.ipCliente());
            linha.put("profissional_id", e.profissionalId());
            linha.put("metodo", e.metodo());
            linha.put("rota", e.rota());
            linha.put("status_code", e.statusCode());
            linha.put("tempo_ms", e.tempoMs());
            log.info(mapper.writeValueAsString(linha));
        } catch (Exception ignored) {
            // o log em stdout é melhor esforço
        }
        if (!fila.offer(e)) {
            log.warn("Fila de access log cheia; entrada mantida apenas no stdout");
        }
    }

    @Scheduled(fixedDelay = 500)
    public void persistir() {
        List<Entrada> lote = new ArrayList<>();
        fila.drainTo(lote, 500);
        if (lote.isEmpty()) return;
        try {
            jdbc.batchUpdate("""
                    INSERT INTO access_log (data_hora, request_id, ip_cliente, profissional_id, metodo, rota,
                                            caminho, status_code, tempo_ms, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, lote, lote.size(), (ps, e) -> {
                ps.setTimestamp(1, Timestamp.from(e.dataHora().toInstant()));
                ps.setString(2, e.requestId());
                ps.setString(3, truncar(e.ipCliente(), 64));
                ps.setObject(4, e.profissionalId());
                ps.setString(5, e.metodo());
                ps.setString(6, truncar(e.rota(), 200));
                ps.setString(7, truncar(e.caminho(), 500));
                ps.setInt(8, e.statusCode());
                ps.setDouble(9, e.tempoMs());
                ps.setString(10, truncar(e.userAgent(), 300));
            });
        } catch (Exception ex) {
            log.error("Falha ao persistir {} entradas de access log", lote.size(), ex);
        }
    }

    private static String truncar(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
