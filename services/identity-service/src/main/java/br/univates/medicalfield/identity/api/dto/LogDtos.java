package br.univates.medicalfield.identity.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class LogDtos {

    private LogDtos() {}

    public record LogEntrada(
            @NotNull UUID id,
            @NotNull OffsetDateTime dataHora,
            @NotNull @Pattern(regexp = "INFO|WARN|ERROR") String nivel,
            UUID profissionalId,
            @NotBlank @Size(max = 40) String acao,
            @Size(max = 40) String entidade,
            @Size(max = 64) String entidadeId,
            Map<String, Object> detalhes) {}

    public record LogBatchRequest(
            @NotBlank @Size(max = 64) String dispositivoId,
            @NotEmpty @Size(max = 500) List<@Valid LogEntrada> logs) {}

    public record LogBatchResponse(int recebidos, int duplicados) {}

    public record LogRegistro(UUID id, String dispositivoId, UUID profissionalId, OffsetDateTime dataHora,
                              String nivel, String acao, String entidade, String entidadeId,
                              Map<String, Object> detalhes, OffsetDateTime recebidoEm) {}
}
