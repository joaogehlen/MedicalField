package br.univates.medicalfield.identity.infra;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ProblemHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemHandler.class);
    private static final MediaType PROBLEM = MediaType.parseMediaType("application/problem+json");

    private final ProblemWriter problems;

    public ProblemHandler(ProblemWriter problems) {
        this.problems = problems;
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> api(ApiException e, HttpServletRequest req) {
        return respond(req, e.status(), e.codigo(), e.titulo(), e.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validacao(MethodArgumentNotValidException e, HttpServletRequest req) {
        List<Map<String, String>> campos = e.getBindingResult().getFieldErrors().stream()
                .map(f -> Map.of("campo", f.getField(), "mensagem", String.valueOf(f.getDefaultMessage())))
                .toList();
        return respond(req, HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", "Dados inválidos",
                "Verifique os campos informados.", campos);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<Map<String, Object>> malformado(Exception e, HttpServletRequest req) {
        return respond(req, HttpStatus.BAD_REQUEST, "REQUISICAO_INVALIDA", "Requisição inválida",
                "O corpo ou os parâmetros da requisição estão malformados.", null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, Object>> negado(AccessDeniedException e, HttpServletRequest req) {
        return respond(req, HttpStatus.FORBIDDEN, "SEM_PERMISSAO", "Sem permissão",
                "Seu papel não tem acesso a este recurso.", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<Map<String, Object>> naoEncontrado(NoResourceFoundException e, HttpServletRequest req) {
        return respond(req, HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", "Não encontrado",
                "Rota inexistente.", null);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> inesperado(Exception e, HttpServletRequest req) {
        log.error("Erro inesperado em {} {}", req.getMethod(), req.getRequestURI(), e);
        return respond(req, HttpStatus.INTERNAL_SERVER_ERROR, "ERRO_INTERNO", "Erro interno",
                "Falha inesperada. Informe o requestId ao suporte.", null);
    }

    private ResponseEntity<Map<String, Object>> respond(HttpServletRequest req, HttpStatus status, String codigo,
                                                        String titulo, String detalhe,
                                                        List<Map<String, String>> campos) {
        return ResponseEntity.status(status).contentType(PROBLEM)
                .body(problems.body(req, status, codigo, titulo, detalhe, campos));
    }
}
