"""Cliente HTTP do clinical-service. Repassa o JWT do usuário (token relay)."""
import httpx

from .config import settings
from .errors import ApiError


def atendimento_detalhe(atendimento_id: str, token: str, request_id: str | None) -> dict:
    try:
        r = httpx.get(
            f"{settings().clinical_base_url}/atendimento/detalhe/{atendimento_id}",
            headers={"Authorization": f"Bearer {token}", "X-Request-Id": request_id or ""},
            timeout=10,
        )
    except httpx.HTTPError as e:
        raise ApiError(502, "CLINICO_INDISPONIVEL", "Serviço clínico indisponível",
                       f"Não foi possível obter o atendimento: {e.__class__.__name__}.") from e
    if r.status_code == 404:
        raise ApiError(404, "NAO_ENCONTRADO", "Não encontrado", "Atendimento não encontrado.")
    if r.status_code in (401, 403):
        raise ApiError(r.status_code, "SEM_PERMISSAO", "Sem permissão", "O serviço clínico recusou o acesso.")
    if r.status_code >= 400:
        raise ApiError(502, "CLINICO_INDISPONIVEL", "Serviço clínico indisponível",
                       f"O serviço clínico respondeu {r.status_code}.")
    return r.json()


def profissionais(ids: set[str], token: str, identity_url: str) -> dict[str, str]:
    """Nome e registro dos profissionais citados na ficha (melhor esforço)."""
    if not ids:
        return {}
    try:
        r = httpx.get(f"{identity_url}/profissional/resumo", params={"ids": ",".join(sorted(ids))},
                      headers={"Authorization": f"Bearer {token}"}, timeout=5)
        r.raise_for_status()
        return {p["id"]: f"{p['nome']} · {p['registro']}" for p in r.json()}
    except httpx.HTTPError:
        return {}
