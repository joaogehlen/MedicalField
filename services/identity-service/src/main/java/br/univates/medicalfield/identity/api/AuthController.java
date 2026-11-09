package br.univates.medicalfield.identity.api;

import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginRequest;
import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginResponse;
import br.univates.medicalfield.identity.api.dto.AuthDtos.LogoutRequest;
import br.univates.medicalfield.identity.api.dto.AuthDtos.ProfissionalDto;
import br.univates.medicalfield.identity.api.dto.AuthDtos.RefreshRequest;
import br.univates.medicalfield.identity.domain.AuthUser;
import br.univates.medicalfield.identity.infra.ApiException;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import br.univates.medicalfield.identity.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService auth;
    private final ProfissionalRepository profissionais;

    public AuthController(AuthService auth, ProfissionalRepository profissionais) {
        this.auth = auth;
        this.profissionais = profissionais;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@Valid @RequestBody RefreshRequest req) {
        return auth.refresh(req.refreshToken(), req.dispositivoId());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequest req) {
        auth.logout(req.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ProfissionalDto me(@AuthenticationPrincipal AuthUser user) {
        return profissionais.porId(user.id()).map(ProfissionalDto::of)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", "Não encontrado",
                        "Profissional do token não existe mais."));
    }
}
