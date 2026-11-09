"""Validação local do JWT RS256 emitido pelo identity-service (chave pública em arquivo)."""
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Request

from .config import settings
from .errors import ApiError


@dataclass(frozen=True)
class Usuario:
    id: str
    nome: str
    papel: str
    registro: str
    token: str


@lru_cache
def _chave() -> str:
    return settings().jwt_public_key


def verificar(token: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            _chave(),
            algorithms=["RS256"],
            issuer=settings().jwt_issuer,
            options={"require": ["exp", "sub", "iss"]},
        )
    except jwt.PyJWTError:
        return None


def usuario_atual(request: Request) -> Usuario:
    """Dependência FastAPI: toda rota deste serviço exige JWT válido."""
    header = request.headers.get("authorization", "")
    claims = verificar(header[7:].strip()) if header.startswith("Bearer ") else None
    if not claims:
        raise ApiError(401, "NAO_AUTENTICADO", "Não autenticado", "Token ausente, inválido ou expirado.")
    usuario = Usuario(
        id=claims["sub"],
        nome=claims.get("nome", ""),
        papel=claims.get("papel", ""),
        registro=claims.get("registro", ""),
        token=header[7:].strip(),
    )
    request.state.profissional_id = usuario.id
    return usuario


def exigir_admin(usuario: Usuario) -> None:
    if usuario.papel != "ADMIN":
        raise ApiError(403, "SEM_PERMISSAO", "Sem permissão", "Seu papel não tem acesso a este recurso.")
