package br.univates.medicalfield.identity.infra;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Monta respostas de erro no formato RFC 7807 (Problem Details). */
@Component
public class ProblemWriter {

    private final ObjectMapper mapper;

    public ProblemWriter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public Map<String, Object> body(HttpServletRequest req, HttpStatus status, String codigo, String titulo,
                                    String detalhe, List<Map<String, String>> campos) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("type", "https://medicalfield/erros/" + codigo.toLowerCase().replace('_', '-'));
        p.put("title", titulo);
        p.put("status", status.value());
        p.put("detail", detalhe);
        p.put("codigo", codigo);
        if (campos != null && !campos.isEmpty()) p.put("campos", campos);
        return p;
    }

    public void write(HttpServletRequest req, HttpServletResponse res, HttpStatus status, String codigo,
                      String titulo, String detalhe) throws IOException {
        res.setStatus(status.value());
        res.setContentType("application/problem+json;charset=UTF-8");
        mapper.writeValue(res.getOutputStream(), body(req, status, codigo, titulo, detalhe, null));
    }
}
