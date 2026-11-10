package br.univates.medicalfield.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "medicalfield")
public record MedicalFieldProperties(Jwt jwt, Seed seed) {

    public record Jwt(String issuer, String privateKeyPath, String publicKeyPath, long accessTtlSeconds) {}

    public record Seed(String senha) {}
}
