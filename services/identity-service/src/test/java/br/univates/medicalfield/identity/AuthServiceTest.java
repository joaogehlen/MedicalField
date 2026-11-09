package br.univates.medicalfield.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginRequest;
import br.univates.medicalfield.identity.config.MedicalFieldProperties;
import br.univates.medicalfield.identity.domain.Papel;
import br.univates.medicalfield.identity.domain.Profissional;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import br.univates.medicalfield.identity.infra.ApiException;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import br.univates.medicalfield.identity.repository.RefreshTokenRepository;
import br.univates.medicalfield.identity.security.JwtService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import br.univates.medicalfield.identity.service.AuthService;

class AuthServiceTest {

    @TempDir Path dir;

    ProfissionalRepository profissionais = mock(ProfissionalRepository.class);
    RefreshTokenRepository refresh = mock(RefreshTokenRepository.class);
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
                new MedicalFieldProperties.Jwt("medicalfield-identity", priv.toString(), pub.toString(), 900, 43200),
                new MedicalFieldProperties.Seed("x"));
        jwt = new JwtService(props, Clock.systemUTC());
        service = new AuthService(profissionais, refresh, encoder, jwt, props, Clock.systemUTC());
        medica = new Profissional(UUID.randomUUID(), "Dra. Ana Souza", TipoRegistro.CRM, "12345", "RS",
                Papel.MEDICO, null, encoder.encode("segredo"), 0, null, true);
    }

    @Test
    void loginValidoEmiteTokenComClaimsDoProfissional() {
        when(profissionais.porRegistro(TipoRegistro.CRM, "12345", "RS")).thenReturn(Optional.of(medica));
        var resp = service.login(new LoginRequest(TipoRegistro.CRM, "12345", "rs", "segredo", "dev-1"));
        var user = jwt.validar(resp.accessToken()).orElseThrow();
        assertThat(user.id()).isEqualTo(medica.id());
        assertThat(user.papel()).isEqualTo(Papel.MEDICO);
        assertThat(user.registro()).isEqualTo("CRM 12345/RS");
        assertThat(resp.refreshToken()).startsWith("rt_");
        verify(profissionais).limparFalhas(medica.id());
    }

    @Test
    void senhaErradaContaTentativaEQuintaBloqueia() {
        when(profissionais.porRegistro(any(), any(), any())).thenReturn(Optional.of(medica));
        assertThatThrownBy(() -> service.login(new LoginRequest(TipoRegistro.CRM, "12345", "RS", "errada", null)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).status()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(profissionais).registrarFalha(eq(medica.id()), eq(1), isNull());

        var quaseBloqueada = new Profissional(medica.id(), medica.nome(), medica.tipoRegistro(), "12345", "RS",
                Papel.MEDICO, null, medica.senhaHash(), 4, null, true);
        when(profissionais.porRegistro(any(), any(), any())).thenReturn(Optional.of(quaseBloqueada));
        assertThatThrownBy(() -> service.login(new LoginRequest(TipoRegistro.CRM, "12345", "RS", "errada", null)))
                .isInstanceOf(ApiException.class);
        verify(profissionais).registrarFalha(eq(medica.id()), eq(0), any(OffsetDateTime.class));
    }

    @Test
    void crmExigeUf() {
        assertThatThrownBy(() -> service.login(new LoginRequest(TipoRegistro.CRM, "12345", null, "segredo", null)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).codigo()).isEqualTo("VALIDACAO");
    }

    @Test
    void tokenAdulteradoEhRejeitado() {
        String token = jwt.emitir(medica);
        String adulterado = token.substring(0, token.length() - 4) + "AAAA";
        assertThat(jwt.validar(adulterado)).isEmpty();
        assertThat(jwt.validar("lixo")).isEmpty();
    }

    private static String pem(String type, byte[] der) {
        return "-----BEGIN " + type + "-----\n" + Base64.getMimeEncoder().encodeToString(der) + "\n-----END " + type + "-----\n";
    }
}
