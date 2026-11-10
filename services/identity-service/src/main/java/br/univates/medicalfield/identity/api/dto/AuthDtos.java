package br.univates.medicalfield.identity.api.dto;

import br.univates.medicalfield.identity.domain.Papel;
import br.univates.medicalfield.identity.domain.Profissional;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {}

    public record LoginRequest(
            @NotNull(message = "informe o tipo de registro") TipoRegistro tipoRegistro,
            @NotBlank(message = "informe o número do registro") @Size(max = 20) String numeroRegistro,
            @Pattern(regexp = "^[A-Za-z]{2}$", message = "UF com 2 letras") String uf,
            @NotBlank(message = "informe a senha") @Size(max = 200) String senha) {}

    public record ProfissionalDto(UUID id, String nome, TipoRegistro tipoRegistro, String numeroRegistro, String uf,
                                  Papel papel, String email, boolean ativo) {
        public static ProfissionalDto of(Profissional p) {
            return new ProfissionalDto(p.id(), p.nome(), p.tipoRegistro(), p.numeroRegistro(), p.uf(), p.papel(),
                    p.email(), p.ativo());
        }
    }

    public record LoginResponse(String accessToken, long expiresIn, ProfissionalDto profissional) {}
}
