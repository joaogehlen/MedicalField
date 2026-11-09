package br.univates.medicalfield.identity.api;

import br.univates.medicalfield.identity.api.dto.AccessLogDto;
import br.univates.medicalfield.identity.api.dto.LogDtos.LogBatchRequest;
import br.univates.medicalfield.identity.api.dto.LogDtos.LogBatchResponse;
import br.univates.medicalfield.identity.api.dto.LogDtos.LogRegistro;
import br.univates.medicalfield.identity.api.dto.PageDto;
import br.univates.medicalfield.identity.domain.AuthUser;
import br.univates.medicalfield.identity.repository.AccessLogRepository;
import br.univates.medicalfield.identity.repository.IdempotencyRepository;
import br.univates.medicalfield.identity.repository.LogClienteRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LogController {

    private final LogClienteRepository logs;
    private final AccessLogRepository accessLogs;
    private final IdempotencyRepository idempotency;
    private final ObjectMapper mapper;

    public LogController(LogClienteRepository logs, AccessLogRepository accessLogs, IdempotencyRepository idempotency,
                         ObjectMapper mapper) {
        this.logs = logs;
        this.accessLogs = accessLogs;
        this.idempotency = idempotency;
        this.mapper = mapper;
    }

    /** Recebe os logs gerados no dispositivo enquanto estava offline. */
    @PostMapping("/log")
    @Transactional
    public ResponseEntity<String> receber(@Valid @RequestBody LogBatchRequest req,
                                          @RequestHeader(value = "Idempotency-Key", required = false) UUID chave,
                                          @AuthenticationPrincipal AuthUser user) throws JsonProcessingException {
        if (chave != null) {
            var anterior = idempotency.buscar(chave, "/log");
            if (anterior.isPresent()) {
                return ResponseEntity.status(anterior.get().status()).contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotent-Replayed", "true").body(anterior.get().corpo());
            }
        }
        int novos = logs.inserir(req.dispositivoId(), user.id(), req.logs());
        String corpo = mapper.writeValueAsString(new LogBatchResponse(novos, req.logs().size() - novos));
        if (chave != null) idempotency.salvar(chave, "/log", HttpStatus.CREATED.value(), corpo);
        return ResponseEntity.status(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON).body(corpo);
    }

    @GetMapping("/log")
    @PreAuthorize("hasRole('ADMIN')")
    public PageDto<LogRegistro> listar(@RequestParam(required = false) UUID profissionalId,
                                       @RequestParam(required = false) String dispositivoId,
                                       @RequestParam(required = false) String acao,
                                       @RequestParam(defaultValue = "1") int pagina,
                                       @RequestParam(defaultValue = "50") int tamanho) {
        return logs.listar(profissionalId, dispositivoId, acao, Math.max(1, pagina), Math.min(Math.max(1, tamanho), 200));
    }

    @GetMapping("/access-log")
    @PreAuthorize("hasRole('ADMIN')")
    public PageDto<AccessLogDto> accessLog(@RequestParam(required = false) UUID profissionalId,
                                           @RequestParam(required = false) Integer status,
                                           @RequestParam(defaultValue = "1") int pagina,
                                           @RequestParam(defaultValue = "50") int tamanho) {
        return accessLogs.listar(profissionalId, status, Math.max(1, pagina), Math.min(Math.max(1, tamanho), 200));
    }
}
