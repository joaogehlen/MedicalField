/** Cliente HTTP do portal: JWT do administrador, renovação automática e Problem Details. */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { LoginRequest, LoginResponse, Problem, Profissional } from '@medicalfield/shared';

export interface Sessao {
  profissional: Profissional;
  accessToken: string;
  refreshToken: string;
  expiraEm: number;
}

const CHAVE = 'mf.portal.sessao';
const ouvintes = new Set<() => void>();
let atual: Sessao | null = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null') as Sessao | null;
  } catch {
    return null;
  }
})();

function definir(s: Sessao | null) {
  atual = s;
  try {
    if (s) sessionStorage.setItem(CHAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    /* sessão só em memória */
  }
  ouvintes.forEach((o) => o());
}

export const useSessao = () =>
  useSyncExternalStore(
    (o) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    },
    () => atual,
  );

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: Problem | null) {
    super(problem?.detail ?? problem?.title ?? (status === 0 ? 'Sem conexão com o servidor.' : `Erro ${status}`));
  }
}

const aplicar = (r: LoginResponse) =>
  definir({ profissional: r.profissional, accessToken: r.accessToken, refreshToken: r.refreshToken, expiraEm: Date.now() + r.expiresIn * 1000 });

async function bruto(metodo: string, rota: string, corpo?: unknown, headers: Record<string, string> = {}) {
  try {
    return await fetch(`/api${rota}`, {
      method: metodo,
      headers: { ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ApiError(0, null);
  }
}

async function falha(r: Response): Promise<never> {
  let p: Problem | null = null;
  try {
    p = (await r.json()) as Problem;
  } catch {
    /* sem corpo */
  }
  throw new ApiError(r.status, p);
}

export async function entrar(req: LoginRequest) {
  const r = await bruto('POST', '/auth/login', req);
  if (!r.ok) await falha(r);
  const dados = (await r.json()) as LoginResponse;
  if (dados.profissional.papel !== 'ADMIN') {
    throw new ApiError(403, { title: 'Sem permissão', status: 403, codigo: 'SEM_PERMISSAO', detail: 'O portal é restrito à central de regulação (perfil administrador).' });
  }
  aplicar(dados);
}

export async function sair() {
  const s = atual;
  definir(null);
  if (s) await bruto('POST', '/auth/logout', { refreshToken: s.refreshToken }, { Authorization: `Bearer ${s.accessToken}` }).catch(() => undefined);
}

async function renovar(): Promise<boolean> {
  if (!atual) return false;
  const r = await bruto('POST', '/auth/refresh', { refreshToken: atual.refreshToken });
  if (!r.ok) return false;
  aplicar((await r.json()) as LoginResponse);
  return true;
}

export async function api<T>(metodo: string, rota: string, corpo?: unknown, opts: { idempotencyKey?: string; blob?: boolean } = {}): Promise<T> {
  if (!atual) throw new ApiError(401, null);
  if (atual.expiraEm - Date.now() < 30_000) await renovar();
  const headers = () => ({
    Authorization: `Bearer ${atual?.accessToken ?? ''}`,
    ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
  });
  let r = await bruto(metodo, rota, corpo, headers());
  if (r.status === 401 && (await renovar())) r = await bruto(metodo, rota, corpo, headers());
  if (r.status === 401) definir(null);
  if (!r.ok) await falha(r);
  if (opts.blob) return (await r.blob()) as T;
  return (await r.json()) as T;
}

/** Busca dados de uma rota; `recarregar` refaz a consulta. */
export function useApi<T>(rota: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const recarregar = useCallback(async () => {
    if (!rota) return;
    setCarregando(true);
    setErro(null);
    try {
      setDados(await api<T>('GET', rota));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [rota]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);
  return { dados, erro, carregando, recarregar };
}

/** Nome e registro dos profissionais (para "registrado por"). */
export function useProfissionais() {
  const { dados } = useApi<Profissional[]>('/profissional');
  const mapa = new Map((dados ?? []).map((p) => [p.id, p]));
  return (id?: string | null) => {
    const p = id ? mapa.get(id) : undefined;
    return p ? `${p.nome} · ${p.tipoRegistro} ${p.numeroRegistro}${p.uf ? `/${p.uf}` : ''}` : id ? id.slice(0, 8) : '—';
  };
}
