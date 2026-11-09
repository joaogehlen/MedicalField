/** Logs de ação gravados no aparelho (inclusive offline) e enviados em POST /log. */
import type { AcaoLog } from '@medicalfield/shared';
import { novoId } from '../api/client';
import { sessao } from '../auth/session';
import { db } from '../data/db';
import { network } from '../sync/network';

export async function registrarLog(
  acao: AcaoLog,
  entidade?: string | null,
  entidadeId?: string | null,
  detalhes: Record<string, unknown> = {},
  nivel: 'INFO' | 'WARN' | 'ERROR' = 'INFO',
) {
  await db.logsLocais.put({
    id: novoId(),
    dataHora: new Date().toISOString(),
    nivel,
    profissionalId: sessao.get()?.profissional.id ?? null,
    acao,
    entidade: entidade ?? null,
    entidadeId: entidadeId ?? null,
    detalhes: { offline: !network.isOnline(), ...detalhes },
    enviado: 0,
  });
}
