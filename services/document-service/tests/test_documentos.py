import email
import socket
import time
from pathlib import Path

import jwt
import pytest
from aiosmtpd.controller import Controller
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import Settings
from app.email.adapters import Anexo, ArquivoEmailAdapter, Mensagem, SmtpEmailAdapter
from app.ficha.builder import montar_ficha

DETALHE = {
    "id": "0f9c0000-0000-4000-8000-000000000001",
    "status": "FINALIZADO",
    "iniciadoEm": "2026-11-02T13:35:00Z",
    "finalizadoEm": "2026-11-02T14:10:00Z",
    "sincronizadoEm": "2026-11-02T14:10:30Z",
    "criadoOffline": True,
    "registradoPor": "p1",
    "local": {"descricao": "BR-386, km 350", "latitude": -29.44, "longitude": -51.96},
    "queixaPrincipal": "Colisão moto × carro",
    "descricao": "Vítima consciente.",
    "triagem": {"protocolo": "START", "classificacao": "AMARELO"},
    "glasgow": {"ocular": 4, "verbal": 4, "motora": 6, "total": 14},
    "sinaisVitais": [{"aferidoEm": "2026-11-02T13:38:00Z", "paSistolica": 130, "paDiastolica": 85, "fc": 102, "fr": 20,
                      "spo2": 96, "temperatura": 36.4, "glicemia": 110, "dor": 8}],
    "medicamentos": [{"medicamentoId": "m1", "dose": 4, "unidade": "mg", "via": "IV", "administradoEm": "2026-11-02T13:45:00Z",
                      "administradoPor": "p1", "observacao": None, "alertasIgnorados": []}],
    "medicamentosCatalogo": [{"id": "m1", "nome": "Morfina", "apresentacao": "Ampola 10 mg/mL"}],
    "procedimentos": ["Imobilização de MID"],
    "adendos": [],
    "pessoa": {"nome": "João Pedro da Silva", "identificada": True, "cpf": "12345678909", "dataNascimento": "1980-05-10",
               "sexo": "M", "telefone": None, "contatoNome": "Maria", "contatoParentesco": "Esposa", "contatoTelefone": None},
    "prontuario": {"tipoSanguineo": "O+", "alergias": ["Dipirona"], "comorbidades": [], "medicamentosUsoContinuo": []},
    "viatura": {"prefixo": "USA 01"},
    "hospitalDestino": {"nome": "Hospital Bruno Born"},
}


def test_builder_gera_pdf_com_hash():
    ficha = montar_ficha(DETALHE, "Dra. Ana", {"p1": "Dra. Ana Souza · CRM 12345/RS"})
    assert ficha.pdf.startswith(b"%PDF")
    assert len(ficha.sha256) == 64
    assert ficha.nome_arquivo == "ficha-atendimento-0f9c0000.pdf"


def _settings(**kw) -> Settings:
    base = dict(database_url="", jwt_public_key_path="", jwt_issuer="medicalfield-identity", clinical_base_url="",
                identity_base_url="", fichas_dir=Path("."), mail_outbox_dir=Path("."), smtp_host=None, smtp_port=25,
                smtp_user=None, smtp_password=None, smtp_from="MedicalField <teste@medicalfield.local>", smtp_starttls=False)
    base.update(kw)
    return Settings(**base)


MSG = Mensagem("maria@exemplo.com.br", "Maria", "Ficha de Atendimento", "Segue a ficha.", Anexo("ficha.pdf", b"%PDF-teste"))


def test_adapter_arquivo_grava_eml_com_anexo(tmp_path):
    ArquivoEmailAdapter(tmp_path, "MedicalField <x@y>").enviar(MSG)
    [eml] = list(tmp_path.glob("*.eml"))
    m = email.message_from_bytes(eml.read_bytes())
    anexos = [p for p in m.walk() if p.get_filename()]
    assert m["To"] == "Maria <maria@exemplo.com.br>"
    assert anexos[0].get_filename() == "ficha.pdf"
    assert anexos[0].get_payload(decode=True) == b"%PDF-teste"


class _Caixa:
    def __init__(self):
        self.mensagens = []

    async def handle_DATA(self, server, session, envelope):
        self.mensagens.append(envelope)
        return "250 OK"


def test_adapter_smtp_entrega_ao_servidor():
    caixa = _Caixa()
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        porta = s.getsockname()[1]
    ctl = Controller(caixa, hostname="127.0.0.1", port=porta)
    ctl.start()
    try:
        message_id = SmtpEmailAdapter(_settings(smtp_host="127.0.0.1", smtp_port=porta)).enviar(MSG)
        time.sleep(0.2)
    finally:
        ctl.stop()
    assert message_id.endswith("@medicalfield>")
    assert caixa.mensagens[0].rcpt_tos == ["maria@exemplo.com.br"]
    assert b"ficha.pdf" in caixa.mensagens[0].content


def test_auth_aceita_somente_rs256_do_emissor(tmp_path, monkeypatch):
    chave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub = tmp_path / "pub.pem"
    pub.write_bytes(chave.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
    monkeypatch.setenv("DATABASE_URL", "postgresql://x")
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", str(pub))
    from app import auth, config
    config.settings.cache_clear()
    auth._chave.cache_clear()
    valido = jwt.encode({"sub": "p1", "iss": "medicalfield-identity", "exp": int(time.time()) + 60}, chave, algorithm="RS256")
    outro = jwt.encode({"sub": "p1", "iss": "outro", "exp": int(time.time()) + 60}, chave, algorithm="RS256")
    hs = jwt.encode({"sub": "p1", "iss": "medicalfield-identity", "exp": int(time.time()) + 60}, "segredo", algorithm="HS256")
    assert auth.verificar(valido)["sub"] == "p1"
    assert auth.verificar(outro) is None
    assert auth.verificar(hs) is None
