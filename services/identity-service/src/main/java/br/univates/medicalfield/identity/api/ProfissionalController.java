package br.univates.medicalfield.identity.api;

import br.univates.medicalfield.identity.api.dto.AuthDtos.ProfissionalDto;
import br.univates.medicalfield.identity.repository.ProfissionalRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Cadastro de apoio: profissionais (somente leitura; inserções direto no banco). */
@RestController
public class ProfissionalController {

    private final ProfissionalRepository profissionais;

    public ProfissionalController(ProfissionalRepository profissionais) {
        this.profissionais = profissionais;
    }

    @GetMapping("/profissional")
    public List<ProfissionalDto> listar() {
        return profissionais.listar().stream().map(ProfissionalDto::of).toList();
    }
}
