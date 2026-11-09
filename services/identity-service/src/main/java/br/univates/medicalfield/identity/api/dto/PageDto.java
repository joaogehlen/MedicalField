package br.univates.medicalfield.identity.api.dto;

import java.util.List;

public record PageDto<T>(List<T> itens, int pagina, int tamanho, long total) {}
