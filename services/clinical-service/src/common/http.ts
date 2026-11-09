import type { Response } from 'express';
import type { RespostaGravada } from '../sync/sync-support';

/** Aplica status e cabeçalho de replay de uma escrita idempotente. */
export function responder(res: Response, r: RespostaGravada & { replay: boolean }) {
  res.status(r.status);
  if (r.replay) res.setHeader('Idempotent-Replayed', 'true');
  return r.corpo;
}

export function paginacao(q: { pagina?: string; tamanho?: string }, padrao = 50) {
  const pagina = Math.max(1, Number(q.pagina) || 1);
  const tamanho = Math.min(200, Math.max(1, Number(q.tamanho) || padrao));
  return { pagina, tamanho, offset: (pagina - 1) * tamanho };
}
