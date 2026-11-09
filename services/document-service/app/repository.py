"""Persistência do document-service (schema document)."""
import json
from datetime import datetime, timezone

from sqlalchemy import Connection

from .db import todos, um


def documento_existente(conn: Connection, atendimento_id: str, versao: int):
    return um(conn, "SELECT * FROM documento_gerado WHERE atendimento_id = :a AND versao_atendimento = :v",
              a=atendimento_id, v=versao)


def salvar_documento(conn: Connection, atendimento_id: str, versao: int, sha256: str, caminho: str, tamanho: int,
                     gerado_por: str):
    return um(
        conn,
        """INSERT INTO documento_gerado (atendimento_id, versao_atendimento, sha256, caminho_arquivo, tamanho_bytes, gerado_por)
           VALUES (:a, :v, :h, :c, :t, :g)
           ON CONFLICT (atendimento_id, versao_atendimento)
           DO UPDATE SET sha256 = EXCLUDED.sha256, caminho_arquivo = EXCLUDED.caminho_arquivo,
                         tamanho_bytes = EXCLUDED.tamanho_bytes, gerado_por = EXCLUDED.gerado_por, gerado_em = now()
           RETURNING *""",
        a=atendimento_id, v=versao, h=sha256, c=caminho, t=tamanho, g=gerado_por,
    )


def documentos(conn: Connection, atendimento_id: str):
    return todos(conn, "SELECT * FROM documento_gerado WHERE atendimento_id = :a ORDER BY gerado_em DESC", a=atendimento_id)


def criar_envio(conn: Connection, documento_id, atendimento_id: str, dest: dict, solicitado_por: str):
    return um(
        conn,
        """INSERT INTO envio_email (documento_id, atendimento_id, destinatario_email, destinatario_nome, tipo, status, solicitado_por)
           VALUES (:d, :a, :e, :n, :t, 'PENDENTE', :s) RETURNING *""",
        d=documento_id, a=atendimento_id, e=dest["email"], n=dest.get("nome"), t=dest["tipo"], s=solicitado_por,
    )


def concluir_envio(conn: Connection, envio_id, message_id: str | None, erro: str | None):
    return um(
        conn,
        """UPDATE envio_email SET status = :st, message_id = :m, erro = :e, enviado_em = :quando
           WHERE id = :id RETURNING *""",
        st="FALHOU" if erro else "ENVIADO", m=message_id, e=erro,
        quando=None if erro else datetime.now(timezone.utc), id=envio_id,
    )


def envios(conn: Connection, atendimento_id: str):
    return todos(conn, "SELECT * FROM envio_email WHERE atendimento_id = :a ORDER BY criado_em DESC", a=atendimento_id)


def resposta_idempotente(conn: Connection, chave: str, rota: str):
    return um(conn, "SELECT status_http, resposta FROM idempotency_key WHERE chave = :c AND rota = :r", c=chave, r=rota)


def gravar_idempotente(conn: Connection, chave: str, rota: str, status: int, corpo: dict) -> None:
    um(conn, """INSERT INTO idempotency_key (chave, rota, status_http, resposta) VALUES (:c, :r, :s, CAST(:b AS jsonb))
                ON CONFLICT (chave) DO NOTHING RETURNING chave""",
       c=chave, r=rota, s=status, b=json.dumps(corpo, default=str))


def access_log(conn: Connection, pagina: int, tamanho: int):
    total = um(conn, "SELECT count(*)::int AS n FROM access_log")["n"]
    itens = todos(conn, "SELECT * FROM access_log ORDER BY id DESC LIMIT :l OFFSET :o", l=tamanho, o=(pagina - 1) * tamanho)
    return total, itens
