/** Logs de ação gravados no aparelho (inclusive offline) e enviados em POST /log. */
import { novoId } from '../api/client';
import { sessao } from '../auth/session';
import { db } from '../data/db';
import { network } from '../sync/network';

export async function registrarLog(acao: string, detalhes: Record<string, unknown> = {}) {
  await db.logsLocais.put({
    id: novoId(),
    dataHora: new Date().toISOString(),
    profissionalId: sessao.get()?.profissional.id ?? null,
    acao,
    detalhes: { offline: !network.isOnline(), ...detalhes },
    enviado: 0,
  });
}
