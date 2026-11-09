package br.univates.medicalfield.identity.repository;

import br.univates.medicalfield.identity.domain.Papel;
import br.univates.medicalfield.identity.domain.Profissional;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ProfissionalRepository {

    private static final RowMapper<Profissional> MAPPER = ProfissionalRepository::map;

    private final JdbcTemplate jdbc;

    public ProfissionalRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Profissional> porRegistro(TipoRegistro tipo, String numero, String uf) {
        return jdbc.query("""
                SELECT * FROM profissional
                WHERE tipo_registro = ? AND numero_registro = ? AND COALESCE(uf, '') = COALESCE(?, '')
                """, MAPPER, tipo.name(), numero, uf).stream().findFirst();
    }

    public Optional<Profissional> porId(UUID id) {
        return jdbc.query("SELECT * FROM profissional WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    public List<Profissional> listar(TipoRegistro tipo, Boolean ativo, String busca) {
        StringBuilder sql = new StringBuilder("SELECT * FROM profissional WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (tipo != null) { sql.append(" AND tipo_registro = ?"); args.add(tipo.name()); }
        if (ativo != null) { sql.append(" AND ativo = ?"); args.add(ativo); }
        if (busca != null && !busca.isBlank()) {
            sql.append(" AND (nome ILIKE ? OR numero_registro ILIKE ?)");
            args.add("%" + busca.trim() + "%");
            args.add("%" + busca.trim() + "%");
        }
        sql.append(" ORDER BY nome");
        return jdbc.query(sql.toString(), MAPPER, args.toArray());
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

    public void registrarFalha(UUID id, int tentativas, OffsetDateTime bloqueadoAte) {
        jdbc.update("UPDATE profissional SET tentativas_falhas = ?, bloqueado_ate = ? WHERE id = ?",
                tentativas, bloqueadoAte, id);
    }

    public void limparFalhas(UUID id) {
        jdbc.update("UPDATE profissional SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?", id);
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
                rs.getInt("tentativas_falhas"),
                rs.getObject("bloqueado_ate", OffsetDateTime.class),
                rs.getBoolean("ativo"));
    }
}
