package br.univates.medicalfield.identity.api;

import br.univates.medicalfield.identity.api.dto.AuthDtos.ProfissionalDto;
import br.univates.medicalfield.identity.domain.TipoRegistro;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import java.util.List;
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
}
