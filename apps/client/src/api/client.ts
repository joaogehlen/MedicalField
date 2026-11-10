/**
 * Cliente HTTP do aparelho. Respeita o simulador de rede: com a chave em Offline
 * nenhuma requisição sai do aparelho.
 */
import { v7 as uuidv7 } from 'uuid';
import type { Problem } from '@medicalfield/shared';
import { sessao } from '../auth/session';
import { network } from '../sync/network';

export class SemConexaoError extends Error {
  constructor() {
    super('Sem conexão com a central.');
  }
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: Problem | null) {
    super(
      problem?.detail ??
        (status >= 502 && status <= 504 ? `Serviço da central fora do ar (erro ${status}).` : `Erro ${status}.`),
    );
  }
}

export async function api<T>(metodo: string, rota: string, corpo?: unknown, idempotencyKey?: string): Promise<T> {
  if (!network.isOnline()) throw new SemConexaoError();
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  const token = sessao.get()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let r: Response;
  try {
    r = await fetch(`/api${rota}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  } catch {
    throw new SemConexaoError();
  }
  if (!r.ok) {
    const problem = (r.headers.get('content-type') ?? '').includes('json') ? ((await r.json()) as Problem) : null;
    throw new ApiError(r.status, problem);
  }
  return (await r.json()) as T;
}

/** Identificador deste aparelho (vai em todo registro). */
export function dispositivoId(): string {
  try {
    let id = localStorage.getItem('mf.dispositivoId');
    if (!id) {
      id = `dev-${uuidv7().slice(-12)}`;
      localStorage.setItem('mf.dispositivoId', id);
    }
    return id;
  } catch {
    return 'dev-sem-armazenamento';
  }
}

export const novoId = () => uuidv7();
