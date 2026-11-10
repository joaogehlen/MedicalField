package br.univates.medicalfield.identity.api;

import br.univates.medicalfield.identity.api.dto.LogDtos.LogBatchRequest;
import br.univates.medicalfield.identity.api.dto.LogDtos.LogBatchResponse;
import br.univates.medicalfield.identity.repository.LogClienteRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LogController {

    private final LogClienteRepository logs;

    public LogController(LogClienteRepository logs) {
        this.logs = logs;
    }

    /** Recebe os logs que o aparelho gerou enquanto estava offline. */
    @PostMapping("/log")
    @ResponseStatus(HttpStatus.CREATED)
    public LogBatchResponse receber(@Valid @RequestBody LogBatchRequest req) throws JsonProcessingException {
        int novos = logs.inserir(req.dispositivoId(), req.logs());
        return new LogBatchResponse(novos, req.logs().size() - novos);
    }
}
