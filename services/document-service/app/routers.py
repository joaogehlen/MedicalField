"""Rotas do document-service: ficha de atendimento em PDF e envio por e-mail."""
import uuid

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text

from . import clinical_client
from .auth import Usuario, usuario_atual
from .config import settings
from .db import transacao
from .email.adapters import Anexo, Mensagem, criar_sender
from .errors import ApiError
from .ficha.builder import montar_ficha

router = APIRouter(dependencies=[Depends(usuario_atual)])


class EnvioRequest(BaseModel):
    email: EmailStr
    nome: str | None = Field(default=None, max_length=160)


def _ficha(atendimento_id: uuid.UUID, usuario: Usuario):
    detalhe = clinical_client.atendimento_detalhe(str(atendimento_id), usuario.token)
    return detalhe, montar_ficha(detalhe, usuario.nome)


@router.get("/ficha/{atendimento_id}/pdf")
def baixar_pdf(atendimento_id: uuid.UUID, usuario: Usuario = Depends(usuario_atual)):
    """Gera a Ficha de Atendimento em PDF para download."""
    _, ficha = _ficha(atendimento_id, usuario)
    return Response(
        content=ficha.pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{ficha.nome_arquivo}"'},
    )


@router.post("/ficha/{atendimento_id}/email")
def enviar_email(atendimento_id: uuid.UUID, corpo: EnvioRequest, request: Request, usuario: Usuario = Depends(usuario_atual)):
    """Envia a ficha em anexo para o paciente ou um familiar."""
    detalhe, ficha = _ficha(atendimento_id, usuario)
    paciente = detalhe["pessoa"]["nome"]
    saudacao = f"Olá, {corpo.nome}." if corpo.nome else "Olá."
    mensagem = Mensagem(
        para_email=corpo.email,
        para_nome=corpo.nome,
        assunto=f"Ficha de Atendimento — {paciente}",
        texto=(
            f"{saudacao}\n\nSegue em anexo a Ficha de Atendimento pré-hospitalar de {paciente}.\n"
            "O documento contém dados pessoais de saúde: compartilhe apenas com quem cuida do paciente.\n\n"
            f"Enviado por {usuario.nome} pelo MedicalField."
        ),
        anexo=Anexo(ficha.nome_arquivo, ficha.pdf),
    )
    try:
        message_id, erro = criar_sender(settings()).enviar(mensagem), None
    except Exception as e:  # noqa: BLE001 — a falha é registrada e devolvida
        message_id, erro = None, f"{e.__class__.__name__}: {e}"[:500]
    with transacao() as conn:
        conn.execute(
            text("""INSERT INTO envio_email (atendimento_id, destinatario_email, status, erro, solicitado_por)
                    VALUES (:a, :e, :s, :erro, :u)"""),
            {"a": str(atendimento_id), "e": corpo.email, "s": "FALHOU" if erro else "ENVIADO", "erro": erro, "u": usuario.id},
        )
    if erro:
        raise ApiError(502, "FALHA_ENVIO_EMAIL", "Falha no envio do e-mail", erro)
    return {"enviadoPara": corpo.email, "messageId": message_id}
