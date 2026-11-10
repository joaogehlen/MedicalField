/** Cliente HTTP do portal: guarda o token do administrador e traduz os erros da API. */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { LoginRequest, LoginResponse, Problem, Profissional } from '@medicalfield/shared';

interface Sessao {
  profissional: Profissional;
  token: string;
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

export const sair = () => definir(null);

async function requisitar(metodo: string, rota: string, corpo?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (atual) headers.Authorization = `Bearer ${atual.token}`;
  let r: Response;
  try {
    r = await fetch(`/api${rota}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }
  if (r.status === 401 && atual) definir(null);
  if (!r.ok) {
    const p = (r.headers.get('content-type') ?? '').includes('json') ? ((await r.json()) as Problem) : null;
    throw new Error(p?.detail ?? p?.title ?? (r.status >= 502 ? `Serviço fora do ar (erro ${r.status}).` : `Erro ${r.status}.`));
  }
  return r;
}

export async function entrar(req: LoginRequest) {
  const dados = (await (await requisitar('POST', '/auth/login', req)).json()) as LoginResponse;
  if (dados.profissional.papel !== 'ADMIN') throw new Error('O portal é restrito à central de regulação (perfil administrador).');
  definir({ profissional: dados.profissional, token: dados.accessToken });
}

export const api = async <T,>(metodo: string, rota: string, corpo?: unknown) => (await (await requisitar(metodo, rota, corpo)).json()) as T;
export const baixar = async (rota: string) => (await requisitar('GET', rota)).blob();

/** Carrega uma rota GET. */
export function useApi<T>(rota: string) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setDados(await api<T>('GET', rota));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, [rota]);
  useEffect(() => void carregar(), [carregar]);
  return { dados, erro };
}
