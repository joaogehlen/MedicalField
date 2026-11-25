package br.univates.medicalfield.identity.service;

import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginRequest;
import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginResponse;
import br.univates.medicalfield.identity.api.dto.AuthDtos.ProfissionalDto;
import br.univates.medicalfield.identity.domain.Profissional;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import br.univates.medicalfield.identity.infra.ApiException;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import br.univates.medicalfield.identity.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final ProfissionalRepository profissionais;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(ProfissionalRepository profissionais, PasswordEncoder encoder, JwtService jwt) {
        this.profissionais = profissionais;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    /**
     * LOGIN, passo a passo:
     *  1. Procura o profissional pelo registro (CRM ou COREN + UF, ou ID de socorrista sem UF).
     *  2. Confere se está ativo e se a senha bate com o hash Argon2 guardado no banco.
     *  3. Errou? 401 CREDENCIAIS_INVALIDAS. Acertou? Devolve o token JWT (assinado com RS256).
     * Daí em diante o token vai em toda requisição: Authorization: Bearer <token>.
     */
    public LoginResponse login(LoginRequest req) {
        boolean socorrista = req.tipoRegistro() == TipoRegistro.SOCORRISTA;
        String uf = socorrista || req.uf() == null || req.uf().isBlank() ? null : req.uf().trim().toUpperCase();
        if (!socorrista && uf == null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", "Dados inválidos",
                    "Informe a UF do " + req.tipoRegistro() + ".");
        }
        Profissional p = profissionais.porRegistro(req.tipoRegistro(), req.numeroRegistro().trim(), uf)
                .filter(Profissional::ativo)
                .filter(x -> encoder.matches(req.senha(), x.senhaHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "CREDENCIAIS_INVALIDAS",
                        "Credenciais inválidas", "Registro profissional ou senha incorretos."));
        return new LoginResponse(jwt.emitir(p), jwt.accessTtlSeconds(), ProfissionalDto.of(p));
    }
}
