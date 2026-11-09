"""Erros de negócio e respostas no formato RFC 7807 (Problem Details)."""
from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, codigo: str, titulo: str, detalhe: str, **extras):
        super().__init__(detalhe)
        self.status = status
        self.codigo = codigo
        self.titulo = titulo
        self.detalhe = detalhe
        self.extras = extras


def problem(request: Request, status: int, codigo: str, titulo: str, detalhe: str, **extras) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content={
            "type": f"https://medicalfield/erros/{codigo.lower().replace('_', '-')}",
            "title": titulo,
            "status": status,
            "detail": detalhe,
            "codigo": codigo,
            "requestId": getattr(request.state, "request_id", None),
            **extras,
        },
    )
