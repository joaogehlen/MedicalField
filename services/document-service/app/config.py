"""Configuração por variáveis de ambiente."""
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_public_key_path: str
    jwt_issuer: str
    clinical_base_url: str
    fichas_dir: Path
    mail_outbox_dir: Path
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    smtp_from: str
    smtp_starttls: bool

    @property
    def jwt_public_key(self) -> str:
        return Path(self.jwt_public_key_path).read_text()


@lru_cache
def settings() -> Settings:
    env = os.environ
    return Settings(
        database_url=env["DATABASE_URL"],
        jwt_public_key_path=env["JWT_PUBLIC_KEY_PATH"],
        jwt_issuer=env.get("JWT_ISSUER", "medicalfield-identity"),
        clinical_base_url=env.get("CLINICAL_BASE_URL", "http://127.0.0.1:3001"),
        fichas_dir=Path(env.get("FICHAS_DIR", "/var/lib/medicalfield/fichas")),
        mail_outbox_dir=Path(env.get("MAIL_OUTBOX_DIR", "/var/lib/medicalfield/mail")),
        smtp_host=env.get("SMTP_HOST") or None,
        smtp_port=int(env.get("SMTP_PORT", "587")),
        smtp_user=env.get("SMTP_USER") or None,
        smtp_password=env.get("SMTP_PASSWORD") or None,
        smtp_from=env.get("SMTP_FROM", "MedicalField <nao-responda@medicalfield.local>"),
        smtp_starttls=env.get("SMTP_STARTTLS", "true").lower() == "true",
    )
