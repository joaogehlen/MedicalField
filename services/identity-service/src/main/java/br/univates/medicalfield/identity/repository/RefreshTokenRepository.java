package br.univates.medicalfield.identity.repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RefreshTokenRepository {

    public record Ativo(UUID id, UUID profissionalId, String dispositivoId) {}

    private final JdbcTemplate jdbc;

    public RefreshTokenRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void salvar(UUID profissionalId, String tokenHash, String dispositivoId, OffsetDateTime expiraEm) {
        jdbc.update("""
                INSERT INTO refresh_token (profissional_id, token_hash, dispositivo_id, expira_em)
                VALUES (?, ?, ?, ?)
                """, profissionalId, tokenHash, dispositivoId, expiraEm);
    }

    /** Token válido: existe, não foi revogado e não expirou. */
    public Optional<Ativo> ativo(String tokenHash) {
        return jdbc.query("""
                SELECT id, profissional_id, dispositivo_id FROM refresh_token
                WHERE token_hash = ? AND revogado_em IS NULL AND expira_em > now()
                """, (rs, i) -> new Ativo(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3)),
                tokenHash).stream().findFirst();
    }

    public void revogar(UUID id) {
        jdbc.update("UPDATE refresh_token SET revogado_em = now() WHERE id = ? AND revogado_em IS NULL", id);
    }

    public void revogarPorHash(String tokenHash) {
        jdbc.update("UPDATE refresh_token SET revogado_em = now() WHERE token_hash = ? AND revogado_em IS NULL",
                tokenHash);
    }
}
