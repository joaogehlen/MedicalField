"""
Middleware de log de acesso (LGPD): data/hora, IP do cliente, profissional autenticado,
método, rota, status e tempo de processamento. A requisição só enfileira; uma thread
grava em lote no banco.
"""
import logging
import queue
import threading
import time
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import text

from .db import engine

log = logging.getLogger("access-log")
_fila: "queue.Queue[dict]" = queue.Queue(maxsize=10_000)


def _gravador() -> None:
    while True:
        lote = [_fila.get()]
        while len(lote) < 500 and not _fila.empty():
            lote.append(_fila.get_nowait())
        try:
            with engine().begin() as conn:
                conn.execute(
                    text("""INSERT INTO access_log (data_hora, ip_cliente, profissional_id, metodo, rota, status_code, tempo_ms)
                            VALUES (:data_hora, :ip_cliente, :profissional_id, :metodo, :rota, :status_code, :tempo_ms)"""),
                    lote,
                )
        except Exception as e:  # noqa: BLE001 — a linha já foi para o stdout
            log.error("Falha ao gravar %d entradas de log de acesso: %s", len(lote), e)


def iniciar_gravador() -> None:
    threading.Thread(target=_gravador, name="access-log", daemon=True).start()


async def middleware(request: Request, call_next):
    inicio = time.perf_counter()
    data_hora = datetime.now(timezone.utc)
    request.state.profissional_id = None
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        xff = request.headers.get("x-forwarded-for")
        entrada = {
            "data_hora": data_hora,
            "ip_cliente": xff.split(",")[0].strip() if xff else (request.client.host if request.client else None),
            "profissional_id": request.state.profissional_id,
            "metodo": request.method,
            "rota": (getattr(request.scope.get("route"), "path", None) or request.url.path)[:200],
            "status_code": status,
            "tempo_ms": round((time.perf_counter() - inicio) * 1000, 2),
        }
        log.info("%s %s %s %s %s %sms profissional=%s", data_hora.isoformat(), entrada["ip_cliente"], entrada["metodo"],
                 entrada["rota"], status, entrada["tempo_ms"], entrada["profissional_id"])
        try:
            _fila.put_nowait(entrada)
        except queue.Full:
            log.warning("Fila do log de acesso cheia")
