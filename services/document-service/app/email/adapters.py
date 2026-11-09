"""
Padrão Adapter: o serviço fala com `EmailSender`; cada adapter traduz para um meio
de entrega (SMTP real, ou arquivo .eml para desenvolvimento e testes).
"""
from __future__ import annotations

import smtplib
import ssl
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path
from typing import Protocol

from ..config import Settings


@dataclass(frozen=True)
class Anexo:
    nome: str
    conteudo: bytes
    tipo: str = "application/pdf"


@dataclass(frozen=True)
class Mensagem:
    para_email: str
    para_nome: str | None
    assunto: str
    texto: str
    anexo: Anexo


class EmailSender(Protocol):
    def enviar(self, m: Mensagem) -> str:
        """Entrega a mensagem e devolve o Message-ID."""


def montar(m: Mensagem, remetente: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = remetente
    msg["To"] = formataddr((m.para_nome or "", m.para_email))
    msg["Subject"] = m.assunto
    msg["Message-ID"] = make_msgid(domain="medicalfield")
    msg.set_content(m.texto)
    principal, sub = m.anexo.tipo.split("/")
    msg.add_attachment(m.anexo.conteudo, maintype=principal, subtype=sub, filename=m.anexo.nome)
    return msg


class SmtpEmailAdapter:
    def __init__(self, s: Settings):
        self.s = s

    def enviar(self, m: Mensagem) -> str:
        msg = montar(m, self.s.smtp_from)
        with smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=20) as smtp:
            if self.s.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if self.s.smtp_user:
                smtp.login(self.s.smtp_user, self.s.smtp_password or "")
            smtp.send_message(msg)
        return msg["Message-ID"]


class ArquivoEmailAdapter:
    """Sem SMTP configurado: grava o e-mail completo (com anexo) como .eml na caixa de saída."""

    def __init__(self, pasta: Path, remetente: str):
        self.pasta = pasta
        self.remetente = remetente

    def enviar(self, m: Mensagem) -> str:
        msg = montar(m, self.remetente)
        self.pasta.mkdir(parents=True, exist_ok=True)
        (self.pasta / f"{uuid.uuid4()}.eml").write_bytes(bytes(msg))
        return msg["Message-ID"]


def criar_sender(s: Settings) -> EmailSender:
    return SmtpEmailAdapter(s) if s.smtp_host else ArquivoEmailAdapter(s.mail_outbox_dir, s.smtp_from)
