package br.univates.medicalfield.identity.repository;

import br.univates.medicalfield.identity.api.dto.LogDtos.LogEntrada;
import br.univates.medicalfield.identity.api.dto.LogDtos.LogRegistro;
import br.univates.medicalfield.identity.api.dto.PageDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    /** Insere ignorando ids já recebidos. Devolve quantos eram novos. */
    public int inserir(String dispositivoId, UUID enviadoPor, List<LogEntrada> logs) {
        int novos = 0;
        for (LogEntrada l : logs) {
            novos += jdbc.update("""
                    INSERT INTO log_cliente (id, dispositivo_id, profissional_id, data_hora, nivel, acao, entidade,
                                             entidade_id, detalhes, enviado_por)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?)
                    ON CONFLICT (id) DO NOTHING
                    """, l.id(), dispositivoId, l.profissionalId(), Timestamp.from(l.dataHora().toInstant()),
                    l.nivel(), l.acao(), l.entidade(), l.entidadeId(), json(l.detalhes()), enviadoPor);
        }
        return novos;
    }

    public PageDto<LogRegistro> listar(UUID profissionalId, String dispositivoId, String acao, int pagina, int tamanho) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (profissionalId != null) { where.append(" AND profissional_id = ?"); args.add(profissionalId); }
        if (dispositivoId != null && !dispositivoId.isBlank()) { where.append(" AND dispositivo_id = ?"); args.add(dispositivoId); }
        if (acao != null && !acao.isBlank()) { where.append(" AND acao = ?"); args.add(acao); }
        Long total = jdbc.queryForObject("SELECT count(*) FROM log_cliente" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(tamanho);
        pageArgs.add((pagina - 1) * tamanho);
        List<LogRegistro> itens = jdbc.query(
                "SELECT * FROM log_cliente" + where + " ORDER BY data_hora DESC LIMIT ? OFFSET ?",
                (rs, i) -> new LogRegistro(
                        rs.getObject("id", UUID.class),
                        rs.getString("dispositivo_id"),
                        rs.getObject("profissional_id", UUID.class),
                        rs.getObject("data_hora", OffsetDateTime.class),
                        rs.getString("nivel"),
                        rs.getString("acao"),
                        rs.getString("entidade"),
                        rs.getString("entidade_id"),
                        parse(rs.getString("detalhes")),
                        rs.getObject("recebido_em", OffsetDateTime.class)),
                pageArgs.toArray());
        return new PageDto<>(itens, pagina, tamanho, total == null ? 0 : total);
    }

    private String json(Map<String, Object> m) {
        if (m == null) return null;
        try {
            return mapper.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private Map<String, Object> parse(String s) {
        if (s == null) return null;
        try {
            return mapper.readValue(s, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
