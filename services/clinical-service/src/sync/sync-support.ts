import { HttpStatus, Injectable } from '@nestjs/common';
import type { Db } from '../db/database.service';
import { DatabaseService } from '../db/database.service';
import { ApiError } from '../common/errors';
import type { NomeEstrategia } from './strategies';

export interface RespostaGravada {
  status: number;
  corpo: unknown;
}

export interface ContextoEscrita {
  /** Idempotency-Key (UUID) ou null quando o cliente não enviou. */
  opId: string | null;
  rota: string;
  profissionalId: string;
  dispositivoId: string | null;
  /** Diferença relógio do cliente − servidor, em ms (X-Client-Time). */
  offsetRelogioMs: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerContexto(
  headers: Record<string, string | string[] | undefined>,
  rota: string,
  profissionalId: string,
  dispositivoId: string | null,
): ContextoEscrita {
  const chave = headers['idempotency-key'];
  const opId = typeof chave === 'string' && chave ? chave : null;
  if (opId && !UUID_RE.test(opId)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'REQUISICAO_INVALIDA', 'Requisição inválida', 'Idempotency-Key deve ser um UUID.');
  }
  const relogio = headers['x-client-time'];
  const t = typeof relogio === 'string' ? Date.parse(relogio) : NaN;
  return { opId, rota, profissionalId, dispositivoId, offsetRelogioMs: Number.isNaN(t) ? null : t - Date.now() };
}

/**
 * Idempotent Receiver: guarda a resposta de cada Idempotency-Key e a devolve num
 * reenvio. Também registra os conflitos resolvidos para auditoria.
 */
@Injectable()
export class SyncSupport {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Executa uma escrita idempotente: devolve a resposta gravada se a Idempotency-Key
   * já foi processada; senão roda `fn` numa transação e grava a resposta junto.
   */
  async executar(
    ctx: ContextoEscrita,
    entidade: string,
    entidadeId: string,
    fn: (tx: Db) => Promise<RespostaGravada>,
  ): Promise<RespostaGravada & { replay: boolean }> {
    const anterior = await this.respostaAnterior(ctx.opId);
    if (anterior) return { ...anterior, replay: true };
    try {
      return await this.db.transaction(async (tx) => {
        const r = await fn(tx);
        await this.gravarResposta(tx, ctx, entidade, entidadeId, r);
        return { ...r, replay: false };
      });
    } catch (e) {
      // Duas entregas simultâneas da mesma operação: a segunda devolve a resposta da primeira.
      if ((e as { code?: string; constraint?: string }).constraint === 'processed_operation_pkey') {
        const gravada = await this.respostaAnterior(ctx.opId);
        if (gravada) return { ...gravada, replay: true };
      }
      throw e;
    }
  }

  async respostaAnterior(opId: string | null): Promise<RespostaGravada | null> {
    if (!opId) return null;
    const r = await this.db.one<{ status_http: number; resposta: unknown }>(
      'SELECT status_http, resposta FROM processed_operation WHERE op_id = $1',
      [opId],
    );
    return r ? { status: r.status_http, corpo: r.resposta } : null;
  }

  async gravarResposta(tx: Db, ctx: ContextoEscrita, entidade: string, entidadeId: string, r: RespostaGravada) {
    if (!ctx.opId) return;
    await tx.query(
      `INSERT INTO processed_operation (op_id, rota, entidade, entidade_id, dispositivo_id, profissional_id, status_http, resposta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [ctx.opId, ctx.rota, entidade, entidadeId, ctx.dispositivoId, ctx.profissionalId, r.status, JSON.stringify(r.corpo)],
    );
  }

  async registrarConflito(
    tx: Db,
    ctx: ContextoEscrita,
    dados: {
      entidade: string;
      entidadeId: string;
      estrategia: NomeEstrategia;
      versaoServidor: number;
      versaoBaseCliente: number | null | undefined;
      valorServidor: unknown;
      valorRecebido: unknown;
      valorResultante: unknown;
    },
  ) {
    await tx.query(
      `INSERT INTO sync_conflito (op_id, entidade, entidade_id, estrategia, versao_servidor, versao_base_cliente,
                                  valor_servidor, valor_recebido, valor_resultante, offset_relogio_ms, dispositivo_id, profissional_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        ctx.opId,
        dados.entidade,
        dados.entidadeId,
        dados.estrategia,
        dados.versaoServidor,
        dados.versaoBaseCliente ?? null,
        JSON.stringify(dados.valorServidor),
        JSON.stringify(dados.valorRecebido),
        JSON.stringify(dados.valorResultante),
        ctx.offsetRelogioMs,
        ctx.dispositivoId,
        ctx.profissionalId,
      ],
    );
  }
}

/** Um conflito existe quando a edição foi feita sobre uma versão anterior à atual do servidor. */
export function houveConflito(versaoServidor: number, baseVersion: number | null | undefined): boolean {
  return (baseVersion ?? 0) < versaoServidor;
}
