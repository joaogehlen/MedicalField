package br.univates.medicalfield.identity.api;

import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginRequest;
import br.univates.medicalfield.identity.api.dto.AuthDtos.LoginResponse;
import br.univates.medicalfield.identity.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    /** Única rota pública: autentica o profissional e devolve o token. */
    @PostMapping("/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }
}
