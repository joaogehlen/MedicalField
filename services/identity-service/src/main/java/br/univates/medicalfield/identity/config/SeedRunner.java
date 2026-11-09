package br.univates.medicalfield.identity.config;

import br.univates.medicalfield.identity.domain.Papel;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Cria os profissionais de demonstração quando a tabela está vazia. A senha vem da
 * configuração (MEDICALFIELD_SEED_SENHA) e é gravada apenas como hash argon2id.
 * Os ids são fixos porque os dados clínicos de demonstração do clinical-service os referenciam.
 */
@Component
public class SeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final ProfissionalRepository profissionais;
    private final PasswordEncoder encoder;
    private final MedicalFieldProperties props;

    public SeedRunner(ProfissionalRepository profissionais, PasswordEncoder encoder, MedicalFieldProperties props) {
        this.profissionais = profissionais;
        this.encoder = encoder;
        this.props = props;
    }

    public static final UUID ADMIN = UUID.fromString("7a1f0000-0000-4000-8000-000000000001");
    public static final UUID MEDICA = UUID.fromString("7a1f0000-0000-4000-8000-000000000002");
    public static final UUID ENFERMEIRO = UUID.fromString("7a1f0000-0000-4000-8000-000000000003");
    public static final UUID SOCORRISTA = UUID.fromString("7a1f0000-0000-4000-8000-000000000004");

    @Override
    public void run(ApplicationArguments args) {
        if (profissionais.contar() > 0) return;
        String hash = encoder.encode(props.seed().senha());
        profissionais.inserir(ADMIN, "Central de Regulação", TipoRegistro.SOCORRISTA, "0001", null, Papel.ADMIN,
                "regulacao@medicalfield.local", hash);
        profissionais.inserir(MEDICA, "Dra. Ana Souza", TipoRegistro.CRM, "12345", "RS", Papel.MEDICO,
                "ana.souza@medicalfield.local", hash);
        profissionais.inserir(ENFERMEIRO, "Enf. Bruno Lima", TipoRegistro.COREN, "54321", "RS", Papel.ENFERMEIRO,
                "bruno.lima@medicalfield.local", hash);
        profissionais.inserir(SOCORRISTA, "Carla Mendes", TipoRegistro.SOCORRISTA, "2048", null, Papel.SOCORRISTA,
                "carla.mendes@medicalfield.local", hash);
        log.info("Profissionais de demonstração criados (4).");
    }
}
