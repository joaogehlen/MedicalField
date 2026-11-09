package br.univates.medicalfield.identity.service;

import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginRequest;
import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginResponse;
import br.univates.medicalfield.identity.api.dto.AuthDtos.ProfissionalDto;
import br.univates.medicalfield.identity.config.MedicalFieldProperties;
import br.univates.medicalfield.identity.domain.Profissional;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import br.univates.medicalfield.identity.infra.ApiException;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import br.univates.medicalfield.identity.repository.RefreshTokenRepository;
import br.univates.medicalfield.identity.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    static final int MAX_TENTATIVAS = 5;
    static final int MINUTOS_BLOQUEIO = 15;

    private final ProfissionalRepository profissionais;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final MedicalFieldProperties props;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public AuthService(ProfissionalRepository profissionais, RefreshTokenRepository refreshTokens,
                       PasswordEncoder encoder, JwtService jwt, MedicalFieldProperties props, Clock clock) {
        this.profissionais = profissionais;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.jwt = jwt;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(noRollbackFor = ApiException.class)
    public LoginResponse login(LoginRequest req) {
        String uf = req.tipoRegistro() == TipoRegistro.SOCORRISTA || req.uf() == null || req.uf().isBlank()
                ? null : req.uf().trim().toUpperCase();
        if (req.tipoRegistro() != TipoRegistro.SOCORRISTA && uf == null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", "Dados inválidos",
                    "Informe a UF do " + req.tipoRegistro() + ".");
        }
        Profissional p = profissionais.porRegistro(req.tipoRegistro(), req.numeroRegistro().trim(), uf)
                .filter(Profissional::ativo)
                .orElseThrow(AuthService::credenciaisInvalidas);

        OffsetDateTime agora = OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
        if (p.bloqueadoAte() != null && p.bloqueadoAte().isAfter(agora)) {
            throw new ApiException(HttpStatus.LOCKED, "USUARIO_BLOQUEADO", "Acesso bloqueado",
                    "Muitas tentativas inválidas. Tente novamente após " + MINUTOS_BLOQUEIO + " minutos.");
        }
        if (!encoder.matches(req.senha(), p.senhaHash())) {
            int tentativas = p.tentativasFalhas() + 1;
            if (tentativas >= MAX_TENTATIVAS) {
                profissionais.registrarFalha(p.id(), 0, agora.plusMinutes(MINUTOS_BLOQUEIO));
            } else {
                profissionais.registrarFalha(p.id(), tentativas, null);
            }
            throw credenciaisInvalidas();
        }
        profissionais.limparFalhas(p.id());
        return emitirPar(p, req.dispositivoId());
    }

    @Transactional
    public LoginResponse refresh(String refreshToken, String dispositivoId) {
        var ativo = refreshTokens.ativo(hash(refreshToken))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "NAO_AUTENTICADO",
                        "Sessão expirada", "Faça login novamente."));
        Profissional p = profissionais.porId(ativo.profissionalId()).filter(Profissional::ativo)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "NAO_AUTENTICADO",
                        "Sessão expirada", "Faça login novamente."));
        refreshTokens.revogar(ativo.id()); // rotação: cada refresh token vale uma vez
        return emitirPar(p, dispositivoId != null ? dispositivoId : ativo.dispositivoId());
    }

    public void logout(String refreshToken) {
        refreshTokens.revogarPorHash(hash(refreshToken));
    }

    private LoginResponse emitirPar(Profissional p, String dispositivoId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String refresh = "rt_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        refreshTokens.salvar(p.id(), hash(refresh), dispositivoId,
                OffsetDateTime.now(clock).plusSeconds(props.jwt().refreshTtlSeconds()));
        return new LoginResponse(jwt.emitir(p), jwt.accessTtlSeconds(), refresh, ProfissionalDto.of(p));
    }

    static String hash(String token) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ApiException credenciaisInvalidas() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "CREDENCIAIS_INVALIDAS", "Credenciais inválidas",
                "Registro profissional ou senha incorretos.");
    }
}
