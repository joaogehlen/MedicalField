"""document-service — Ficha de Atendimento em PDF e envio por e-mail."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import access_log
from .db import migrar
from .errors import ApiError, problem
from .routers import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("document-service")

app = FastAPI(title="MedicalField document-service", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)
app.middleware("http")(access_log.middleware)
app.include_router(router)


@app.on_event("startup")
def iniciar() -> None:
    migrar()
    access_log.iniciar_gravador()
    log.info("document-service pronto")


@app.exception_handler(ApiError)
def _api_error(request: Request, e: ApiError):
    return problem(request, e.status, e.codigo, e.titulo, e.detalhe, **e.extras)


@app.exception_handler(RequestValidationError)
def _validacao(request: Request, e: RequestValidationError):
    campos = [{"campo": ".".join(str(p) for p in err["loc"][1:]) or "(corpo)", "mensagem": err["msg"]} for err in e.errors()]
    return problem(request, 422, "VALIDACAO", "Dados inválidos", "Verifique os campos informados.", campos=campos)


@app.exception_handler(StarletteHTTPException)
def _http(request: Request, e: StarletteHTTPException):
    if e.status_code == 404:
        return problem(request, 404, "NAO_ENCONTRADO", "Não encontrado", "Rota inexistente.")
    return problem(request, e.status_code, "ERRO", "Erro", str(e.detail))


@app.exception_handler(Exception)
def _inesperado(request: Request, e: Exception):
    log.exception("Erro inesperado em %s %s", request.method, request.url.path)
    return problem(request, 500, "ERRO_INTERNO", "Erro interno", "Falha inesperada no servidor.")
