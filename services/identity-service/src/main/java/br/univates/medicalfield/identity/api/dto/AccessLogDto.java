package br.univates.medicalfield.identity.api.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AccessLogDto(long id, String servico, OffsetDateTime dataHora, String requestId, String ipCliente,
                           UUID profissionalId, String metodo, String rota, String caminho, int statusCode,
                           double tempoMs, String userAgent) {}
