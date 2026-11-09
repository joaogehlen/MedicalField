package br.univates.medicalfield.identity.api;

import br.univates.medicalfield.identity.api.dto.AuthDtos.ProfissionalDto;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Cadastro de apoio: profissionais (somente leitura; inserções direto no banco). */
@RestController
public class ProfissionalController {

    private final ProfissionalRepository profissionais;

    public ProfissionalController(ProfissionalRepository profissionais) {
        this.profissionais = profissionais;
    }

    @GetMapping("/profissional")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ProfissionalDto> listar(@RequestParam(required = false) TipoRegistro tipoRegistro,
                                        @RequestParam(required = false) Boolean ativo,
                                        @RequestParam(required = false) String busca) {
        return profissionais.listar(tipoRegistro, ativo, busca).stream().map(ProfissionalDto::of).toList();
    }

    /** Identificação pública (nome e registro) de profissionais, para fichas e listagens. */
    public record ProfissionalResumo(UUID id, String nome, String registro) {}

    @GetMapping("/profissional/resumo")
    public List<ProfissionalResumo> resumo(@RequestParam String ids) {
        return Arrays.stream(ids.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(100)
                .map(s -> {
                    try { return UUID.fromString(s); } catch (IllegalArgumentException e) { return null; }
                })
                .filter(Objects::nonNull)
                .distinct()
                .map(profissionais::porId)
                .flatMap(java.util.Optional::stream)
                .map(p -> new ProfissionalResumo(p.id(), p.nome(), p.registro()))
                .toList();
    }
}
