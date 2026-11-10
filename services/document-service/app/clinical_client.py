"""Cliente HTTP do clinical-service. Repassa o JWT do usuário (token relay)."""
import httpx

from .config import settings
from .errors import ApiError


def atendimento_detalhe(atendimento_id: str, token: str) -> dict:
    try:
        r = httpx.get(f"{settings().clinical_base_url}/atendimento/detalhe/{atendimento_id}",
                      headers={"Authorization": f"Bearer {token}"}, timeout=10)
    except httpx.HTTPError as e:
        raise ApiError(502, "CLINICO_INDISPONIVEL", "Serviço clínico indisponível",
                       f"Não foi possível obter o atendimento ({e.__class__.__name__}).") from e
    if r.status_code == 404:
        raise ApiError(404, "NAO_ENCONTRADO", "Não encontrado", "Atendimento não encontrado.")
    if r.status_code >= 400:
        raise ApiError(502, "CLINICO_INDISPONIVEL", "Serviço clínico indisponível", f"O serviço clínico respondeu {r.status_code}.")
    return r.json()
