package br.univates.medicalfield.identity.security;

import br.univates.medicalfield.identity.config.MedicalFieldProperties;
import br.univates.medicalfield.identity.domain.AuthUser;
import br.univates.medicalfield.identity.domain.Papel;
import br.univates.medicalfield.identity.domain.Profissional;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.text.ParseException;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Emite e valida os JWT RS256. A chave privada só existe neste serviço; os demais
 * validam com a chave pública distribuída como arquivo.
 */
@Service
public class JwtService {

    private final MedicalFieldProperties.Jwt cfg;
    private final RSAPrivateKey privateKey;
    private final RSASSAVerifier verifier;
    private final Clock clock;

    public JwtService(MedicalFieldProperties props, Clock clock) {
        this.cfg = props.jwt();
        this.privateKey = PemKeys.privateKey(cfg.privateKeyPath());
        RSAPublicKey publicKey = PemKeys.publicKey(cfg.publicKeyPath());
        this.verifier = new RSASSAVerifier(publicKey);
        this.clock = clock;
    }

    public long accessTtlSeconds() {
        return cfg.accessTtlSeconds();
    }

    public String emitir(Profissional p) {
        Instant agora = clock.instant();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer(cfg.issuer())
                .subject(p.id().toString())
                .jwtID(UUID.randomUUID().toString())
                .issueTime(Date.from(agora))
                .expirationTime(Date.from(agora.plusSeconds(cfg.accessTtlSeconds())))
                .claim("nome", p.nome())
                .claim("papel", p.papel().name())
                .claim("tipoRegistro", p.tipoRegistro().name())
                .claim("registro", p.registro())
                .build();
        try {
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.RS256).type(JOSEObjectType.JWT).build(), claims);
            jwt.sign(new RSASSASigner(privateKey));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Falha ao assinar o token", e);
        }
    }

    /** Valida assinatura, emissor e expiração. Vazio se o token for inválido. */
    public Optional<AuthUser> validar(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.RS256.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(verifier)) {
                return Optional.empty();
            }
            JWTClaimsSet c = jwt.getJWTClaimsSet();
            if (!cfg.issuer().equals(c.getIssuer()) || c.getExpirationTime() == null
                    || c.getExpirationTime().toInstant().isBefore(clock.instant())) {
                return Optional.empty();
            }
            return Optional.of(new AuthUser(
                    UUID.fromString(c.getSubject()),
                    c.getStringClaim("nome"),
                    Papel.valueOf(c.getStringClaim("papel")),
                    c.getStringClaim("registro")));
        } catch (ParseException | JOSEException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
