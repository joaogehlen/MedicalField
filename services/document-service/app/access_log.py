"""
Interceptor de auditoria (LGPD): registra cada requisição HTTP com data/hora, IP do
cliente, profissional autenticado, método, rota, status e tempo em ms. A requisição só
enfileira; uma thread grava em lote. Cada linha também vai para o stdout em JSON.
"""
import json
import logging
import queue
import threading
import time
import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import text

from .db import engine

log = logging.getLogger("access-log")
_fila: "queue.Queue[dict]" = queue.Queue(maxsize=10_000)


def _corta(s, n):
    return s[:n] if isinstance(s, str) else s


def _gravador() -> None:
    while True:
        lote = [_fila.get()]
        try:
            while len(lote) < 500:
                lote.append(_fila.get_nowait())
        except queue.Empty:
            pass
        try:
            with engine().begin() as conn:
                conn.execute(
                    text(
                        """INSERT INTO access_log (data_hora, request_id, ip_cliente, profissional_id, metodo, rota,
                           caminho, status_code, tempo_ms, user_agent)
                           VALUES (:data_hora, :request_id, :ip_cliente, :profissional_id, :metodo, :rota, :caminho,
                                   :status_code, :tempo_ms, :user_agent)"""
                    ),
                    lote,
                )
        except Exception as e:  # noqa: BLE001 — o stdout já tem a linha
            log.error("Falha ao persistir %d entradas de access log: %s", len(lote), e)


def iniciar_gravador() -> None:
    threading.Thread(target=_gravador, name="access-log-writer", daemon=True).start()


async def middleware(request: Request, call_next):
    inicio = time.perf_counter()
    data_hora = datetime.now(timezone.utc)
    rid = request.headers.get("x-request-id")
    request.state.request_id = rid if rid and len(rid) <= 64 else str(uuid.uuid4())
    request.state.profissional_id = None
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        response.headers["X-Request-Id"] = request.state.request_id
        return response
    finally:
        rota = getattr(request.scope.get("route"), "path", None) or request.url.path
        xff = request.headers.get("x-forwarded-for")
        entrada = {
            "data_hora": data_hora,
            "request_id": request.state.request_id,
            "ip_cliente": _corta(xff.split(",")[0].strip() if xff else (request.client.host if request.client else None), 64),
            "profissional_id": request.state.profissional_id,
            "metodo": request.method,
            "rota": _corta(rota, 200),
            "caminho": _corta(request.url.path, 500),
            "status_code": status,
            "tempo_ms": round((time.perf_counter() - inicio) * 1000, 2),
            "user_agent": _corta(request.headers.get("user-agent"), 300),
        }
        linha = {k: v for k, v in entrada.items() if k not in ("caminho", "user_agent")}
        log.info(json.dumps({"servico": "document-service", **linha, "data_hora": data_hora.isoformat()}))
        try:
            _fila.put_nowait(entrada)
        except queue.Full:
            log.warning("Fila de access log cheia; entrada mantida apenas no stdout")
