import email
import socket
import time
from pathlib import Path

import jwt
from aiosmtpd.controller import Controller
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import Settings
from app.email.adapters import Anexo, ArquivoEmailAdapter, Mensagem, SmtpEmailAdapter
from app.ficha.builder import montar_ficha

DETALHE = {
    "id": "0f9c0000-0000-4000-8000-000000000001",
    "dataHora": "2026-11-02T13:35:00Z",
    "sincronizadoEm": "2026-11-02T14:10:30Z",
    "criadoOffline": True,
    "local": "BR-386, km 350",
    "queixaPrincipal": "Colisão moto × carro",
    "observacoes": "Consciente.",
    "triagem": {"protocolo": "START", "classificacao": "AMARELO"},
    "glasgow": {"ocular": 4, "verbal": 4, "motora": 6, "total": 14},
    "sinaisVitais": {"paSistolica": 130, "paDiastolica": 85, "fc": 102, "fr": 20, "spo2": 96, "temperatura": 36.4, "glicemia": 110},
    "medicamentos": [{"medicamentoId": "m1", "dose": 4, "via": "IV", "horario": "2026-11-02T13:45:00Z"}],
    "medicamentosCatalogo": [{"id": "m1", "nome": "Morfina", "apresentacao": "Ampola 10 mg/mL", "unidade": "mg"}],
    "profissionalNome": "Dra. Ana Souza · CRM 12345/RS",
    "pessoa": {"nome": "João Pedro da Silva", "cpf": "12345678909", "dataNascimento": "1980-05-10", "sexo": "M"},
    "prontuario": {"tipoSanguineo": "O+", "alergias": ["Dipirona"], "comorbidades": []},
}


def test_builder_gera_pdf():
    ficha = montar_ficha(DETALHE, "Dra. Ana")
    assert ficha.pdf.startswith(b"%PDF")
    assert ficha.nome_arquivo == "ficha-atendimento-0f9c0000.pdf"


def _settings(**kw) -> Settings:
    base = dict(database_url="", jwt_public_key_path="", jwt_issuer="medicalfield-identity", clinical_base_url="",
                mail_outbox_dir=Path("."), smtp_host=None, smtp_port=25, smtp_user=None,
                smtp_password=None, smtp_from="MedicalField <teste@medicalfield.local>", smtp_starttls=False)
    base.update(kw)
    return Settings(**base)


MSG = Mensagem("maria@exemplo.com.br", "Maria", "Ficha de Atendimento", "Segue a ficha.", Anexo("ficha.pdf", b"%PDF-teste"))


def test_adapter_arquivo_grava_eml_com_anexo(tmp_path):
    ArquivoEmailAdapter(tmp_path, "MedicalField <x@y>").enviar(MSG)
    [eml] = list(tmp_path.glob("*.eml"))
    anexo = [p for p in email.message_from_bytes(eml.read_bytes()).walk() if p.get_filename()][0]
    assert anexo.get_payload(decode=True) == b"%PDF-teste"


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
        SmtpEmailAdapter(_settings(smtp_host="127.0.0.1", smtp_port=porta)).enviar(MSG)
        time.sleep(0.2)
    finally:
        ctl.stop()
    assert caixa.mensagens[0].rcpt_tos == ["maria@exemplo.com.br"]


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
    hs = jwt.encode({"sub": "p1", "iss": "medicalfield-identity", "exp": int(time.time()) + 60}, "segredo", algorithm="HS256")
    assert auth.verificar(valido)["sub"] == "p1"
    assert auth.verificar(hs) is None
