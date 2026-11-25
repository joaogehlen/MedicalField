"""
PADRÃO BUILDER — "montar um hambúrguer em camadas"

A ficha do atendimento (o PDF do prontuário) é montada seção por seção:
    cabecalho → paciente → ocorrencia → avaliacao → medicamentos → responsavel → build()
Cada método preenche um pedaço e devolve o próprio builder (por isso dá para encadear).
build() coloca tudo no template ficha.html e o WeasyPrint transforma o HTML em PDF.
montar_ficha(), no fim do arquivo, é o "diretor": é ele que decide a ordem das seções.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

TEMPLATES = Path(__file__).parent / "templates"
FUSO = ZoneInfo("America/Sao_Paulo")

SIGNIFICADO = {
    "START": {"VERMELHO": "Imediato", "AMARELO": "Retardado", "VERDE": "Leve", "PRETO": "Óbito / expectante"},
    "MANCHESTER": {"VERMELHO": "Emergência", "LARANJA": "Muito urgente", "AMARELO": "Urgente",
                   "VERDE": "Pouco urgente", "AZUL": "Não urgente"},
}
GLASGOW = {
    "ocular": {4: "Espontânea", 3: "Ao estímulo verbal", 2: "Ao estímulo de pressão", 1: "Ausente"},
    "verbal": {5: "Orientado", 4: "Confuso", 3: "Palavras", 2: "Sons", 1: "Ausente"},
    "motora": {6: "Obedece comandos", 5: "Localiza estímulo", 4: "Flexão normal", 3: "Flexão anormal",
               2: "Extensão", 1: "Ausente"},
}
SEXO = {"M": "Masculino", "F": "Feminino", "O": "Outro"}


def _data(iso: str | None, formato: str = "%d/%m/%Y %H:%M") -> str:
    if not iso:
        return "—"
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(FUSO).strftime(formato)


def _cpf(cpf: str | None) -> str:
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}" if cpf and len(cpf) == 11 else "—"


def _num(v) -> str:
    if v is None:
        return "—"
    return (f"{float(v):.1f}" if float(v) % 1 else f"{int(float(v))}").replace(".", ",")


# O PRODUTO FINAL: os bytes do PDF e o nome do arquivo.
@dataclass
class Ficha:
    pdf: bytes
    nome_arquivo: str


# O BUILDER
# Começa vazio (_ctx) e cada método preenche uma seção da ficha a partir dos dados do atendimento,
# já formatando para leitura (datas em pt-BR, CPF com pontos, cor e significado da triagem).
@dataclass
class FichaAtendimentoBuilder:
    # Cada método preenche um pedaço do _ctx e devolve self: por isso dá para fazer .a().b().c()
    _ctx: dict = field(default_factory=dict)

    # Camada 1: número, data e a cor da triagem.
    def cabecalho(self, a: dict) -> FichaAtendimentoBuilder:
        t = a["triagem"]
        self._ctx.update(
            numero=a["id"].split("-")[0].upper(),
            id=a["id"],
            data_hora=_data(a["dataHora"]),
            offline=bool(a.get("criadoOffline")),
            sincronizado=_data(a.get("sincronizadoEm")),
            triagem={
                "classificacao": t["classificacao"],
                "cor": t["classificacao"].capitalize(),
                "protocolo": "START" if t["protocolo"] == "START" else "Manchester",
                "significado": SIGNIFICADO[t["protocolo"]].get(t["classificacao"], ""),
            },
        )
        return self

    # Camada 2: dados da vítima + prontuário (tipo sanguíneo e alergias).
    def paciente(self, p: dict, pr: dict) -> FichaAtendimentoBuilder:
        self._ctx["paciente"] = {
            "nome": p["nome"],
            "cpf": _cpf(p.get("cpf")),
            "nascimento": _data(p.get("dataNascimento") + "T12:00:00Z", "%d/%m/%Y") if p.get("dataNascimento") else "—",
            "sexo": SEXO.get(p.get("sexo") or "", "—"),
            "telefone": p.get("telefone") or "—",
            "contato": p.get("contatoNome") or "—",
            "tipo_sanguineo": pr.get("tipoSanguineo") or "—",
            "alergias": pr.get("alergias") or [],
            "comorbidades": ", ".join(pr.get("comorbidades") or []) or "Nenhuma registrada",
        }
        return self

    # Camada 3: local, queixa e observações.
    def ocorrencia(self, a: dict) -> FichaAtendimentoBuilder:
        self._ctx["ocorrencia"] = {"local": a["local"], "queixa": a["queixaPrincipal"], "observacoes": a.get("observacoes")}
        return self

    # Camada 4: Glasgow e sinais vitais.
    def avaliacao(self, a: dict) -> FichaAtendimentoBuilder:
        g, s = a["glasgow"], a["sinaisVitais"]
        self._ctx["glasgow"] = {
            "total": g["total"],
            "itens": [(k.capitalize(), g[k], GLASGOW[k][g[k]]) for k in ("ocular", "verbal", "motora")],
            "gravidade": "Leve" if g["total"] >= 13 else "Moderado" if g["total"] >= 9 else "Grave",
        }
        pa = f"{s['paSistolica']}/{s['paDiastolica']}" if s.get("paSistolica") and s.get("paDiastolica") else "—"
        self._ctx["sinais"] = [
            ("PA", pa, "mmHg"), ("FC", _num(s.get("fc")), "bpm"), ("FR", _num(s.get("fr")), "irpm"),
            ("SpO₂", _num(s.get("spo2")), "%"), ("Temp.", _num(s.get("temperatura")), "°C"),
            ("Glicemia", _num(s.get("glicemia")), "mg/dL"),
        ]
        return self

    # Camada 5: medicamentos dados, com hora, dose e via.
    def medicamentos(self, itens: list[dict], catalogo: list[dict]) -> FichaAtendimentoBuilder:
        nomes = {m["id"]: m for m in catalogo}
        self._ctx["medicamentos"] = [
            {
                "hora": _data(m["horario"], "%H:%M"),
                "nome": nomes.get(m["medicamentoId"], {}).get("nome", "Medicamento"),
                "apresentacao": nomes.get(m["medicamentoId"], {}).get("apresentacao", ""),
                "dose": f"{_num(m['dose'])} {nomes.get(m['medicamentoId'], {}).get('unidade', '')}",
                "via": m["via"],
            }
            for m in itens
        ]
        return self

    # Camada 6: quem atendeu.
    def responsavel(self, nome: str) -> FichaAtendimentoBuilder:
        self._ctx["responsavel"] = nome
        return self

    # A ÚLTIMA ETAPA: junta todas as seções no template ficha.html (Jinja2) e o WeasyPrint
    # converte o HTML em PDF. Devolve a Ficha pronta para download ou para anexar no e-mail.
    def build(self, emitido_por: str) -> Ficha:
        env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html"]))
        self._ctx["emitido"] = f"{datetime.now(FUSO).strftime('%d/%m/%Y %H:%M')} por {emitido_por}"
        html = env.get_template("ficha.html").render(**self._ctx)
        pdf = HTML(string=html, base_url=str(TEMPLATES)).write_pdf()
        return Ficha(pdf=pdf, nome_arquivo=f"ficha-atendimento-{self._ctx['numero'].lower()}.pdf")


def montar_ficha(detalhe: dict, emitido_por: str) -> Ficha:
    """
    O DIRETOR: decide a ordem das seções e chama o builder passo a passo.
    É esta função que as rotas de PDF e de e-mail usam (routers.py).
    """
    return (
        FichaAtendimentoBuilder()
        .cabecalho(detalhe)
        .paciente(detalhe["pessoa"], detalhe["prontuario"])
        .ocorrencia(detalhe)
        .avaliacao(detalhe)
        .medicamentos(detalhe["medicamentos"], detalhe.get("medicamentosCatalogo") or [])
        .responsavel(detalhe["profissionalNome"])
        .build(emitido_por)
    )
