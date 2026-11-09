"""Acesso ao PostgreSQL (schema document) e migração na subida."""
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from sqlalchemy import Connection, Engine, create_engine, text

from .config import settings

MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"


@lru_cache
def engine() -> Engine:
    return create_engine(
        settings().database_url,
        pool_size=5,
        pool_pre_ping=True,
        connect_args={"options": "-c search_path=document"},
    )


@contextmanager
def transacao() -> Iterator[Connection]:
    with engine().begin() as conn:
        yield conn


def migrar() -> None:
    with transacao() as conn:
        for arquivo in sorted(MIGRATIONS.glob("*.sql")):
            conn.exec_driver_sql(arquivo.read_text())


def um(conn: Connection, sql: str, **params):
    return conn.execute(text(sql), params).mappings().first()


def todos(conn: Connection, sql: str, **params):
    return list(conn.execute(text(sql), params).mappings())
