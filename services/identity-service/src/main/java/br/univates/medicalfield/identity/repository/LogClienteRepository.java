package br.univates.medicalfield.identity.repository;

import br.univates.medicalfield.identity.api.dto.LogDtos.LogEntrada;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class LogClienteRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public LogClienteRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Insere ignorando ids já recebidos (reenvio não duplica). Devolve quantos eram novos. */
    public int inserir(String dispositivoId, List<LogEntrada> logs) throws JsonProcessingException {
        int novos = 0;
        for (LogEntrada l : logs) {
            novos += jdbc.update("""
                    INSERT INTO log_cliente (id, dispositivo_id, profissional_id, data_hora, acao, detalhes)
                    VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb))
                    ON CONFLICT (id) DO NOTHING
                    """, l.id(), dispositivoId, l.profissionalId(), Timestamp.from(l.dataHora().toInstant()), l.acao(),
                    l.detalhes() == null ? null : mapper.writeValueAsString(l.detalhes()));
        }
        return novos;
    }
}
