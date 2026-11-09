"""Rotas do document-service: ficha em PDF, envio por e-mail e auditoria."""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, EmailStr, Field

from . import clinical_client, repository as repo
from .auth import Usuario, exigir_admin, usuario_atual
from .config import settings
from .db import transacao
from .email.adapters import Anexo, Mensagem, criar_sender
from .errors import ApiError
from .ficha.builder import montar_ficha

router = APIRouter(dependencies=[Depends(usuario_atual)])


class Destinatario(BaseModel):
    email: EmailStr
    nome: str | None = Field(default=None, max_length=160)
    tipo: Literal["PACIENTE", "FAMILIAR", "HOSPITAL"]


class EnvioRequest(BaseModel):
    destinatarios: list[Destinatario] = Field(min_length=1, max_length=5)
    mensagem: str | None = Field(default=None, max_length=2000)


def _iso(v):
    return v.isoformat() if isinstance(v, datetime) else v


def _envio_dto(e) -> dict:
    return {
        "id": str(e["id"]), "atendimentoId": str(e["atendimento_id"]), "destinatarioEmail": e["destinatario_email"],
        "destinatarioNome": e["destinatario_nome"], "tipo": e["tipo"], "status": e["status"], "messageId": e["message_id"],
        "erro": e["erro"], "criadoEm": _iso(e["criado_em"]), "enviadoEm": _iso(e["enviado_em"]),
    }


def _gerar(atendimento_id: str, usuario: Usuario, request: Request):
    """Obtém o atendimento no clinical-service e gera (ou reaproveita) o PDF da versão atual."""
    detalhe = clinical_client.atendimento_detalhe(atendimento_id, usuario.token, request.state.request_id)
    with transacao() as conn:
        existente = repo.documento_existente(conn, atendimento_id, detalhe["version"])
    if existente and Path(existente["caminho_arquivo"]).exists():
        return detalhe, existente, Path(existente["caminho_arquivo"]).read_bytes()

    ids = {detalhe["registradoPor"], *(m["administradoPor"] for m in detalhe["medicamentos"])}
    nomes = clinical_client.profissionais(ids, usuario.token, settings().identity_base_url)
    emitente = f"{usuario.nome} ({usuario.registro})" if usuario.registro else usuario.nome
    ficha = montar_ficha(detalhe, emitente, nomes)
    pasta = settings().fichas_dir
    pasta.mkdir(parents=True, exist_ok=True)
    caminho = pasta / f"{atendimento_id}-v{detalhe['version']}.pdf"
    caminho.write_bytes(ficha.pdf)
    with transacao() as conn:
        doc = repo.salvar_documento(conn, atendimento_id, detalhe["version"], ficha.sha256, str(caminho), len(ficha.pdf), usuario.id)
    return detalhe, doc, ficha.pdf


def _nome_arquivo(atendimento_id: str) -> str:
    return f"ficha-atendimento-{atendimento_id.split('-')[0]}.pdf"


@router.get("/ficha/{atendimento_id}/pdf")
def baixar_pdf(atendimento_id: uuid.UUID, request: Request, usuario: Usuario = Depends(usuario_atual)):
    _, doc, pdf = _gerar(str(atendimento_id), usuario, request)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_nome_arquivo(str(atendimento_id))}"',
            "X-Documento-Sha256": doc["sha256"],
        },
    )


@router.post("/ficha/{atendimento_id}/email")
def enviar_email(
    atendimento_id: uuid.UUID,
    corpo: EnvioRequest,
    request: Request,
    usuario: Usuario = Depends(usuario_atual),
    idempotency_key: uuid.UUID | None = Header(default=None),
):
    rota = f"/ficha/{atendimento_id}/email"
    if idempotency_key:
        with transacao() as conn:
            anterior = repo.resposta_idempotente(conn, str(idempotency_key), rota)
        if anterior:
            return JSONResponse(anterior["resposta"], status_code=anterior["status_http"], headers={"Idempotent-Replayed": "true"})

    detalhe, doc, pdf = _gerar(str(atendimento_id), usuario, request)
    paciente = detalhe["pessoa"]["nome"]
    sender = criar_sender(settings())
    resultados = []
    for d in corpo.destinatarios:
        with transacao() as conn:
            envio = repo.criar_envio(conn, doc["id"], str(atendimento_id), d.model_dump(), usuario.id)
        saudacao = f"Olá, {d.nome}." if d.nome else "Olá."
        texto = (
            f"{saudacao}\n\n"
            + (f"{corpo.mensagem.strip()}\n\n" if corpo.mensagem else "")
            + f"Segue em anexo a Ficha de Atendimento pré-hospitalar de {paciente}.\n"
            "O documento contém dados pessoais de saúde: guarde-o com cuidado e compartilhe apenas com a equipe que cuida do paciente.\n\n"
            f"Enviado por {usuario.nome} pelo MedicalField."
        )
        try:
            message_id = sender.enviar(Mensagem(
                para_email=d.email, para_nome=d.nome, assunto=f"Ficha de Atendimento — {paciente}", texto=texto,
                anexo=Anexo(_nome_arquivo(str(atendimento_id)), pdf),
            ))
            erro = None
        except Exception as e:  # noqa: BLE001 — falha de entrega é registrada e devolvida
            message_id, erro = None, f"{e.__class__.__name__}: {e}"[:500]
        with transacao() as conn:
            resultados.append(_envio_dto(repo.concluir_envio(conn, envio["id"], message_id, erro)))

    falhas = [r for r in resultados if r["status"] == "FALHOU"]
    if falhas and len(falhas) == len(resultados):
        raise ApiError(502, "FALHA_ENVIO_EMAIL", "Falha no envio do e-mail", falhas[0]["erro"] or "Servidor de e-mail recusou.",
                       envios=resultados)
    resposta = {"envios": resultados, "sha256": doc["sha256"]}
    if idempotency_key:
        with transacao() as conn:
            repo.gravar_idempotente(conn, str(idempotency_key), rota, 200, resposta)
    return resposta


@router.get("/ficha/{atendimento_id}/envios")
def listar_envios(atendimento_id: uuid.UUID):
    with transacao() as conn:
        return [_envio_dto(e) for e in repo.envios(conn, str(atendimento_id))]


@router.get("/ficha/{atendimento_id}/documentos")
def listar_documentos(atendimento_id: uuid.UUID):
    with transacao() as conn:
        return [
            {"id": str(d["id"]), "versaoAtendimento": d["versao_atendimento"], "sha256": d["sha256"],
             "tamanhoBytes": d["tamanho_bytes"], "geradoPor": str(d["gerado_por"]), "geradoEm": _iso(d["gerado_em"])}
            for d in repo.documentos(conn, str(atendimento_id))
        ]


@router.get("/ficha/access-log")
def access_log(pagina: int = Query(1, ge=1), tamanho: int = Query(50, ge=1, le=200), usuario: Usuario = Depends(usuario_atual)):
    exigir_admin(usuario)
    with transacao() as conn:
        total, itens = repo.access_log(conn, pagina, tamanho)
    return {
        "itens": [
            {"id": r["id"], "servico": "document-service", "dataHora": _iso(r["data_hora"]), "requestId": r["request_id"],
             "ipCliente": r["ip_cliente"], "profissionalId": str(r["profissional_id"]) if r["profissional_id"] else None,
             "metodo": r["metodo"], "rota": r["rota"], "caminho": r["caminho"], "statusCode": r["status_code"],
             "tempoMs": float(r["tempo_ms"]), "userAgent": r["user_agent"]}
            for r in itens
        ],
        "pagina": pagina, "tamanho": tamanho, "total": total,
    }
