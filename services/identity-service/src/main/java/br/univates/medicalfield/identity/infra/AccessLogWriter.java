package br.univates.medicalfield.identity.infra;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Grava o log de acesso de forma assíncrona: a requisição só enfileira; um agendador grava em lote. */
@Component
public class AccessLogWriter {

    public record Entrada(OffsetDateTime dataHora, String ipCliente, UUID profissionalId, String metodo, String rota,
                          int statusCode, double tempoMs) {}

    private static final Logger log = LoggerFactory.getLogger("access-log");

    private final LinkedBlockingQueue<Entrada> fila = new LinkedBlockingQueue<>(10_000);
    private final JdbcTemplate jdbc;

    public AccessLogWriter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void registrar(Entrada e) {
        log.info("{} {} {} {} {} {}ms profissional={}", e.dataHora(), e.ipCliente(), e.metodo(), e.rota(),
                e.statusCode(), e.tempoMs(), e.profissionalId());
        fila.offer(e);
    }

    @Scheduled(fixedDelay = 500)
    public void persistir() {
        List<Entrada> lote = new ArrayList<>();
        fila.drainTo(lote, 500);
        if (lote.isEmpty()) return;
        try {
            jdbc.batchUpdate("""
                    INSERT INTO access_log (data_hora, ip_cliente, profissional_id, metodo, rota, status_code, tempo_ms)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, lote, lote.size(), (ps, e) -> {
                ps.setTimestamp(1, Timestamp.from(e.dataHora().toInstant()));
                ps.setString(2, e.ipCliente());
                ps.setObject(3, e.profissionalId());
                ps.setString(4, e.metodo());
                ps.setString(5, e.rota().length() > 200 ? e.rota().substring(0, 200) : e.rota());
                ps.setInt(6, e.statusCode());
                ps.setDouble(7, e.tempoMs());
            });
        } catch (Exception ex) {
            log.error("Falha ao gravar {} entradas de log de acesso", lote.size(), ex);
        }
    }
}
