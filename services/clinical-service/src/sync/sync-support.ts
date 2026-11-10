import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService, type Db } from '../db/database.service';
import { ApiError } from '../common/errors';
import type { NomeEstrategia } from './strategies';

export interface RespostaGravada {
  status: number;
  corpo: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê o cabeçalho Idempotency-Key (opcional). */
export function chaveIdempotencia(headers: Record<string, string | undefined>): string | null {
  const chave = headers['idempotency-key'];
  if (!chave) return null;
  if (!UUID_RE.test(chave)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'REQUISICAO_INVALIDA', 'Requisição inválida', 'Idempotency-Key deve ser um UUID.');
  }
  return chave;
}

/** Um conflito existe quando a edição foi feita sobre uma versão anterior à do servidor. */
export const houveConflito = (versaoServidor: number, baseVersion?: number | null) => (baseVersion ?? 0) < versaoServidor;

/**
 * Idempotent Receiver: guarda a resposta de cada Idempotency-Key e a devolve num
 * reenvio, sem executar a escrita de novo. Também registra os conflitos resolvidos.
 */
@Injectable()
export class SyncSupport {
  constructor(private readonly db: DatabaseService) {}

  async executar(opId: string | null, fn: (tx: Db) => Promise<RespostaGravada>): Promise<RespostaGravada & { replay: boolean }> {
    if (opId) {
      const anterior = await this.db.one('SELECT status_http, resposta FROM processed_operation WHERE op_id = $1', [opId]);
      if (anterior) return { status: anterior.status_http, corpo: anterior.resposta, replay: true };
    }
    const r = await this.db.transaction(async (tx) => {
      const resposta = await fn(tx);
      if (opId) {
        await tx.query('INSERT INTO processed_operation (op_id, status_http, resposta) VALUES ($1, $2, $3)', [
          opId,
          resposta.status,
          JSON.stringify(resposta.corpo),
        ]);
      }
      return resposta;
    });
    return { ...r, replay: false };
  }

  async registrarConflito(tx: Db, entidade: string, id: string, estrategia: NomeEstrategia, servidor: unknown, recebido: unknown, resultado: unknown) {
    await tx.query(
      `INSERT INTO sync_conflito (entidade, entidade_id, estrategia, valor_servidor, valor_recebido, valor_resultante)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entidade, id, estrategia, JSON.stringify(servidor), JSON.stringify(recebido), JSON.stringify(resultado)],
    );
  }
}
