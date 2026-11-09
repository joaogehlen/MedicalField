package br.univates.medicalfield.identity.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Respostas já dadas a uma Idempotency-Key, para devolver a mesma resposta num reenvio. */
@Repository
public class IdempotencyRepository {

    public record Resposta(int status, String corpo) {}

    private final JdbcTemplate jdbc;

    public IdempotencyRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Resposta> buscar(UUID chave, String rota) {
        return jdbc.query("SELECT status_http, resposta::text FROM idempotency_key WHERE chave = ? AND rota = ?",
                (rs, i) -> new Resposta(rs.getInt(1), rs.getString(2)), chave, rota).stream().findFirst();
    }

    public void salvar(UUID chave, String rota, int status, String corpo) {
        jdbc.update("""
                INSERT INTO idempotency_key (chave, rota, status_http, resposta) VALUES (?, ?, ?, CAST(? AS jsonb))
                ON CONFLICT (chave) DO NOTHING
                """, chave, rota, status, corpo);
    }
}
