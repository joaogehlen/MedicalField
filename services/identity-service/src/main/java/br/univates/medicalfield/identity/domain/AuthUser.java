package br.univates.medicalfield.identity.domain;

import java.util.UUID;

/** Profissional autenticado, extraído do JWT. */
public record AuthUser(UUID id, String nome, Papel papel, String registro) {}
