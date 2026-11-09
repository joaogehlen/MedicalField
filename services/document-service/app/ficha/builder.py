"""
Padrão Builder: monta a Ficha de Atendimento seção por seção, separando a construção
do documento (dados de cada bloco) da sua representação (HTML → PDF).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

TEMPLATES = Path(__file__).parent / "templates"
FUSO = ZoneInfo("America/Sao_Paulo")

ROTULO_TRIAGEM = {
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


def _dh(iso: str | None) -> str:
    if not iso:
        return "—"
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(FUSO).strftime("%d/%m/%Y %H:%M")


def _hora(iso: str | None) -> str:
    if not iso:
        return "—"
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(FUSO).strftime("%H:%M")


def _cpf(cpf: str | None) -> str:
    if not cpf or len(cpf) != 11:
        return cpf or "—"
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"


def _num(v, casas: int = 0) -> str:
    if v is None:
        return "—"
    s = f"{float(v):,.{casas}f}" if casas else f"{float(v):,.3f}".rstrip("0").rstrip(".")
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _idade(nasc: str | None, ref: str) -> str:
    if not nasc:
        return "—"
    n = datetime.fromisoformat(nasc).date()
    r = datetime.fromisoformat(ref.replace("Z", "+00:00")).date()
    anos = r.year - n.year - ((r.month, r.day) < (n.month, n.day))
    return f"{anos} anos"


@dataclass
class Ficha:
    """Produto do builder: o documento pronto e sua impressão digital."""
    pdf: bytes
    sha256: str
    nome_arquivo: str


@dataclass
class FichaAtendimentoBuilder:
    profissionais: dict[str, str] = field(default_factory=dict)
    _ctx: dict = field(default_factory=dict)

    def cabecalho(self, a: dict) -> FichaAtendimentoBuilder:
        self._ctx["numero"] = a["id"].split("-")[0].upper()
        self._ctx["id"] = a["id"]
        self._ctx["status"] = "Finalizado" if a["status"] == "FINALIZADO" else "Em andamento"
        self._ctx["iniciado"] = _dh(a["iniciadoEm"])
        self._ctx["finalizado"] = _dh(a.get("finalizadoEm"))
        self._ctx["offline"] = bool(a.get("criadoOffline"))
        self._ctx["sincronizado"] = _dh(a.get("sincronizadoEm"))
        return self

    def paciente(self, p: dict, ref: str) -> FichaAtendimentoBuilder:
        self._ctx["paciente"] = {
            "nome": p["nome"],
            "identificada": p["identificada"],
            "cpf": _cpf(p.get("cpf")),
            "nascimento": datetime.fromisoformat(p["dataNascimento"]).strftime("%d/%m/%Y") if p.get("dataNascimento") else "—",
            "idade": _idade(p.get("dataNascimento"), ref),
            "sexo": SEXO.get(p.get("sexo") or "", "—"),
            "telefone": p.get("telefone") or "—",
            "caracteristicas": p.get("caracteristicas"),
            "contato": " · ".join(x for x in [p.get("contatoNome"), p.get("contatoParentesco"), p.get("contatoTelefone")] if x) or "—",
        }
        return self

    def prontuario(self, pr: dict) -> FichaAtendimentoBuilder:
        self._ctx["prontuario"] = {
            "tipo_sanguineo": pr.get("tipoSanguineo") or "—",
            "alergias": pr.get("alergias") or [],
            "comorbidades": ", ".join(pr.get("comorbidades") or []) or "Nenhuma registrada",
            "uso_continuo": ", ".join(pr.get("medicamentosUsoContinuo") or []) or "Nenhum registrado",
            "observacoes": pr.get("observacoes"),
        }
        return self

    def ocorrencia(self, a: dict) -> FichaAtendimentoBuilder:
        local = a["local"]
        coords = (f"{_num(local['latitude'], 5)}, {_num(local['longitude'], 5)}"
                  if local.get("latitude") is not None and local.get("longitude") is not None else None)
        self._ctx["ocorrencia"] = {
            "local": local["descricao"],
            "coordenadas": coords,
            "queixa": a["queixaPrincipal"],
            "descricao": a.get("descricao"),
            "viatura": (a.get("viatura") or {}).get("prefixo", "—"),
            "destino": (a.get("hospitalDestino") or {}).get("nome", "—"),
            "procedimentos": a.get("procedimentos") or [],
        }
        return self

    def triagem(self, a: dict) -> FichaAtendimentoBuilder:
        t, g = a["triagem"], a["glasgow"]
        self._ctx["triagem"] = {
            "protocolo": "START" if t["protocolo"] == "START" else "Manchester",
            "classificacao": t["classificacao"],
            "cor": t["classificacao"].capitalize(),
            "significado": ROTULO_TRIAGEM[t["protocolo"]].get(t["classificacao"], ""),
        }
        self._ctx["glasgow"] = {
            "total": g["total"],
            "itens": [(k.capitalize(), g[k], GLASGOW[k][g[k]]) for k in ("ocular", "verbal", "motora")],
            "gravidade": "Leve" if g["total"] >= 13 else "Moderado" if g["total"] >= 9 else "Grave",
        }
        return self

    def sinais_vitais(self, sinais: list[dict]) -> FichaAtendimentoBuilder:
        self._ctx["sinais"] = [
            {
                "hora": _hora(s["aferidoEm"]),
                "pa": f"{s['paSistolica']}/{s['paDiastolica']}" if s.get("paSistolica") and s.get("paDiastolica") else "—",
                "fc": _num(s.get("fc")), "fr": _num(s.get("fr")), "spo2": _num(s.get("spo2")),
                "temp": _num(s.get("temperatura"), 1), "glic": _num(s.get("glicemia")), "dor": _num(s.get("dor")),
            }
            for s in sinais
        ]
        return self

    def medicamentos(self, itens: list[dict], catalogo: list[dict]) -> FichaAtendimentoBuilder:
        nomes = {m["id"]: m for m in catalogo}
        self._ctx["medicamentos"] = [
            {
                "hora": _hora(m["administradoEm"]),
                "nome": nomes.get(m["medicamentoId"], {}).get("nome", "Medicamento"),
                "apresentacao": nomes.get(m["medicamentoId"], {}).get("apresentacao", ""),
                "dose": f"{_num(m['dose'])} {m['unidade']}",
                "via": m["via"],
                "por": self.profissionais.get(m["administradoPor"], m["administradoPor"][:8]),
                "obs": m.get("observacao"),
                "justificativas": [f"{j['codigo']}: {j['justificativa']}" for j in m.get("alertasIgnorados") or []],
            }
            for m in itens
        ]
        return self

    def adendos(self, adendos: list[dict]) -> FichaAtendimentoBuilder:
        self._ctx["adendos"] = [{"quando": _dh(d["criadoEm"]), "texto": d["texto"]} for d in adendos or []]
        return self

    def responsavel(self, profissional_id: str) -> FichaAtendimentoBuilder:
        self._ctx["responsavel"] = self.profissionais.get(profissional_id, "Profissional não identificado")
        return self

    def build(self, emitido_por: str) -> Ficha:
        env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html"]))
        self._ctx["emitido_em"] = datetime.now(FUSO).strftime("%d/%m/%Y %H:%M")
        self._ctx["emitido_por"] = emitido_por
        html = env.get_template("ficha.html").render(**self._ctx)
        pdf = HTML(string=html, base_url=str(TEMPLATES)).write_pdf()
        return Ficha(pdf=pdf, sha256=hashlib.sha256(pdf).hexdigest(),
                     nome_arquivo=f"ficha-atendimento-{self._ctx['numero'].lower()}.pdf")


def montar_ficha(detalhe: dict, emitido_por: str, profissionais: dict[str, str] | None = None) -> Ficha:
    """Diretor: a ordem das seções da ficha de APH."""
    b = FichaAtendimentoBuilder(profissionais=profissionais or {})
    return (
        b.cabecalho(detalhe)
        .paciente(detalhe["pessoa"], detalhe["iniciadoEm"])
        .prontuario(detalhe["prontuario"])
        .ocorrencia(detalhe)
        .triagem(detalhe)
        .sinais_vitais(detalhe["sinaisVitais"])
        .medicamentos(detalhe["medicamentos"], detalhe.get("medicamentosCatalogo") or [])
        .adendos(detalhe.get("adendos") or [])
        .responsavel(detalhe["registradoPor"])
        .build(emitido_por)
    )
