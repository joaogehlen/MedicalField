import type { Response } from 'express';
import type { RespostaGravada } from '../sync/sync-support';

/** Aplica o status de uma escrita idempotente e sinaliza reenvios. */
export function responder(res: Response, r: RespostaGravada & { replay: boolean }) {
  res.status(r.status);
  if (r.replay) res.setHeader('Idempotent-Replayed', 'true');
  return r.corpo;
}
