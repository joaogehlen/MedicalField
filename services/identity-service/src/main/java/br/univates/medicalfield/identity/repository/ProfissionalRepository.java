package br.univates.medicalfield.identity.repository;

import br.univates.medicalfield.identity.domain.Papel;
import br.univates.medicalfield.identity.domain.Profissional;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ProfissionalRepository {

    private final JdbcTemplate jdbc;

    public ProfissionalRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Profissional> porRegistro(TipoRegistro tipo, String numero, String uf) {
        return jdbc.query("""
                SELECT * FROM profissional
                WHERE tipo_registro = ? AND numero_registro = ? AND COALESCE(uf, '') = COALESCE(?, '')
                """, ProfissionalRepository::map, tipo.name(), numero, uf).stream().findFirst();
    }

    public List<Profissional> listar() {
        return jdbc.query("SELECT * FROM profissional ORDER BY nome", ProfissionalRepository::map);
    }

    public long contar() {
        Long n = jdbc.queryForObject("SELECT count(*) FROM profissional", Long.class);
        return n == null ? 0 : n;
    }

    public void inserir(UUID id, String nome, TipoRegistro tipo, String numero, String uf, Papel papel, String email,
                        String senhaHash) {
        jdbc.update("""
                INSERT INTO profissional (id, nome, tipo_registro, numero_registro, uf, papel, email, senha_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, id, nome, tipo.name(), numero, uf, papel.name(), email, senhaHash);
    }

    private static Profissional map(ResultSet rs, int i) throws SQLException {
        return new Profissional(
                rs.getObject("id", UUID.class),
                rs.getString("nome"),
                TipoRegistro.valueOf(rs.getString("tipo_registro")),
                rs.getString("numero_registro"),
                rs.getString("uf"),
                Papel.valueOf(rs.getString("papel")),
                rs.getString("email"),
                rs.getString("senha_hash"),
                rs.getBoolean("ativo"));
    }
}
