package br.univates.medicalfield.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginRequest;
import br.univates.medicalfield.identity.config.MedicalFieldProperties;
import br.univates.medicalfield.identity.domain.Papel;
import br.univates.medicalfield.identity.domain.Profissional;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import br.univates.medicalfield.identity.infra.ApiException;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import br.univates.medicalfield.identity.security.JwtService;
import br.univates.medicalfield.identity.service.AuthService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Clock;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

    @TempDir Path dir;

    ProfissionalRepository profissionais = mock(ProfissionalRepository.class);
    PasswordEncoder encoder = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    JwtService jwt;
    AuthService service;
    Profissional medica;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        KeyPair kp = gen.generateKeyPair();
        Path priv = dir.resolve("priv.pem");
        Path pub = dir.resolve("pub.pem");
        Files.writeString(priv, pem("PRIVATE KEY", kp.getPrivate().getEncoded()));
        Files.writeString(pub, pem("PUBLIC KEY", kp.getPublic().getEncoded()));
        var props = new MedicalFieldProperties(
                new MedicalFieldProperties.Jwt("medicalfield-identity", priv.toString(), pub.toString(), 43200),
                new MedicalFieldProperties.Seed("x"));
        jwt = new JwtService(props, Clock.systemUTC());
        service = new AuthService(profissionais, encoder, jwt);
        medica = new Profissional(UUID.randomUUID(), "Dra. Ana Souza", TipoRegistro.CRM, "12345", "RS", Papel.MEDICO,
                null, encoder.encode("segredo"), true);
    }

    @Test
    void loginValidoEmiteTokenDoProfissional() {
        when(profissionais.porRegistro(TipoRegistro.CRM, "12345", "RS")).thenReturn(Optional.of(medica));
        var resp = service.login(new LoginRequest(TipoRegistro.CRM, "12345", "rs", "segredo"));
        var user = jwt.validar(resp.accessToken()).orElseThrow();
        assertThat(user.id()).isEqualTo(medica.id());
        assertThat(user.registro()).isEqualTo("CRM 12345/RS");
    }

    @Test
    void senhaErradaDa401() {
        when(profissionais.porRegistro(any(), any(), any())).thenReturn(Optional.of(medica));
        assertThatThrownBy(() -> service.login(new LoginRequest(TipoRegistro.CRM, "12345", "RS", "errada")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void crmExigeUf() {
        assertThatThrownBy(() -> service.login(new LoginRequest(TipoRegistro.CRM, "12345", null, "segredo")))
                .extracting(e -> ((ApiException) e).codigo()).isEqualTo("VALIDACAO");
    }

    @Test
    void tokenAdulteradoEhRejeitado() {
        String token = jwt.emitir(medica);
        assertThat(jwt.validar(token.substring(0, token.length() - 4) + "AAAA")).isEmpty();
    }

    private static String pem(String type, byte[] der) {
        return "-----BEGIN " + type + "-----\n" + Base64.getMimeEncoder().encodeToString(der) + "\n-----END " + type + "-----\n";
    }
}
