package br.univates.medicalfield.identity.repository;

import br.univates.medicalfield.identity.api.dto.AccessLogDto;
import br.univates.medicalfield.identity.api.dto.PageDto;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AccessLogRepository {

    private final JdbcTemplate jdbc;

    public AccessLogRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public PageDto<AccessLogDto> listar(UUID profissionalId, Integer status, int pagina, int tamanho) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (profissionalId != null) { where.append(" AND profissional_id = ?"); args.add(profissionalId); }
        if (status != null) { where.append(" AND status_code = ?"); args.add(status); }
        Long total = jdbc.queryForObject("SELECT count(*) FROM access_log" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(tamanho);
        pageArgs.add((pagina - 1) * tamanho);
        List<AccessLogDto> itens = jdbc.query(
                "SELECT * FROM access_log" + where + " ORDER BY id DESC LIMIT ? OFFSET ?",
                (rs, i) -> new AccessLogDto(
                        rs.getLong("id"),
                        "identity-service",
                        rs.getObject("data_hora", OffsetDateTime.class),
                        rs.getString("request_id"),
                        rs.getString("ip_cliente"),
                        rs.getObject("profissional_id", UUID.class),
                        rs.getString("metodo"),
                        rs.getString("rota"),
                        rs.getString("caminho"),
                        rs.getInt("status_code"),
                        rs.getDouble("tempo_ms"),
                        rs.getString("user_agent")),
                pageArgs.toArray());
        return new PageDto<>(itens, pagina, tamanho, total == null ? 0 : total);
    }
}
