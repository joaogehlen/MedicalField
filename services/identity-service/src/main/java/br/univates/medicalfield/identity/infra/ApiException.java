package br.univates.medicalfield.identity.infra;

import org.springframework.http.HttpStatus;

/** Erro de negócio convertido em Problem Details pelo {@link ProblemHandler}. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String codigo;
    private final String titulo;

    public ApiException(HttpStatus status, String codigo, String titulo, String detalhe) {
        super(detalhe);
        this.status = status;
        this.codigo = codigo;
        this.titulo = titulo;
    }

    public HttpStatus status() { return status; }
    public String codigo() { return codigo; }
    public String titulo() { return titulo; }
}
