/**
 * Cliente HTTP do dispositivo. Respeita o simulador de rede: com a chave em Offline
 * nenhuma requisição sai do aparelho (falha imediata, sem esperar timeout).
 */
import { v7 as uuidv7 } from 'uuid';
import type { LoginResponse, Problem } from '@medicalfield/shared';
import { atualizarRefreshDaCredencial, sessao } from '../auth/session';
import { network } from '../sync/network';

export class NetworkUnavailableError extends Error {
  constructor() {
    super('Sem conexão com a central.');
  }
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: Problem | null) {
    super(problem?.detail ?? problem?.title ?? `Erro ${status}`);
  }
  get codigo() {
    return this.problem?.codigo ?? 'ERRO';
  }
}

export class SessaoExpiradaError extends Error {
  constructor() {
    super('Sessão expirada: entre novamente com conexão para sincronizar.');
  }
}

export interface Opcoes {
  idempotencyKey?: string;
  semAuth?: boolean;
  blob?: boolean;
}

const BASE = `${import.meta.env.BASE_URL.replace(/\/app\/$/, '')}/api`;

let renovando: Promise<boolean> | null = null;

/** Renova o access token com o refresh token (rotação). */
export function renovarToken(): Promise<boolean> {
  renovando ??= (async () => {
    const s = sessao.get();
    if (!s?.refreshToken || !network.isOnline()) return false;
    try {
      const r = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken, dispositivoId: dispositivoId() }),
      });
      if (!r.ok) return false;
      const dados = (await r.json()) as LoginResponse;
      sessao.aplicarLogin(dados);
      await atualizarRefreshDaCredencial(dados.profissional.id, dados.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (renovando = null), 0);
    }
  })();
  return renovando;
}

async function tokenValido(): Promise<string> {
  const s = sessao.get();
  if (s?.accessToken && s.expiraEm && s.expiraEm - Date.now() > 30_000) return s.accessToken;
  if (await renovarToken()) return sessao.get()!.accessToken!;
  throw new SessaoExpiradaError();
}

export async function api<T>(metodo: string, rota: string, corpo?: unknown, opts: Opcoes = {}): Promise<T> {
  if (!network.isOnline()) throw new NetworkUnavailableError();
  const enviar = async (token: string | null) => {
    const headers: Record<string, string> = { 'X-Client-Time': new Date().toISOString() };
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    try {
      return await fetch(`${BASE}${rota}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    } catch {
      throw new NetworkUnavailableError();
    }
  };

  let resposta = await enviar(opts.semAuth ? null : await tokenValido());
  if (resposta.status === 401 && !opts.semAuth) {
    if (!(await renovarToken())) throw new SessaoExpiradaError();
    resposta = await enviar(sessao.get()!.accessToken);
  }
  if (resposta.status === 502 || resposta.status === 503 || resposta.status === 504) {
    // Gateway sem o serviço: para o dispositivo é o mesmo que estar sem rede.
    if (!(resposta.headers.get('content-type') ?? '').includes('json')) throw new NetworkUnavailableError();
  }
  if (!resposta.ok) {
    let problem: Problem | null = null;
    try {
      problem = (await resposta.json()) as Problem;
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(resposta.status, problem);
  }
  if (opts.blob) return (await resposta.blob()) as T;
  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}

/** Identificador estável deste aparelho (vai em todo registro e log). */
export function dispositivoId(): string {
  const CHAVE = 'mf.dispositivoId';
  try {
    let id = localStorage.getItem(CHAVE);
    if (!id) {
      id = `dev-${uuidv7().slice(-12)}`;
      localStorage.setItem(CHAVE, id);
    }
    return id;
  } catch {
    return 'dev-sem-armazenamento';
  }
}

export const novoId = () => uuidv7();
