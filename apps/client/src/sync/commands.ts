/**
 * PADRÃO COMMAND — "a comanda do restaurante"
 *
 * Tudo que é salvo offline vira um pedido guardado numa fila (a Outbox, no IndexedDB).
 * Quando a internet volta, o SyncEngine pega cada pedido e chama execute().
 * Deu erro de rede? O pedido fica na fila e é executado de novo depois.
 * Reenviar não duplica: cada pedido leva o seu opId como Idempotency-Key.
 */
import type { Table } from 'dexie';
import { db, type OperacaoOutbox } from '../data/db';
import { remoto } from '../data/repositories';

// Todo comando só precisa saber se executar.
export interface OutboxCommand {
  execute(): Promise<void>;
}

class UpsertCommand<L extends { id: string; version?: number; syncStatus: string }> implements OutboxCommand {
  constructor(
    private readonly op: OperacaoOutbox,
    private readonly tabela: Table<L, string>,
    private readonly destino: { salvar(registro: unknown, opId: string): Promise<{ registro: unknown }> },
  ) {}

  // Executar o pedido: 1) pega o registro no aparelho  2) envia à central  3) marca como sincronizado.
  async execute() {
    const registro = await this.tabela.get(this.op.entidadeId);
    if (!registro) return;
    const { syncStatus: _s, version, ...dados } = registro as L & { syncErro?: unknown };
    delete (dados as { syncErro?: unknown }).syncErro;
    const r = await this.destino.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
    await this.tabela.put({ ...(r.registro as L), syncStatus: 'SINCRONIZADO' });
  }
}

// Transforma um item da fila no comando certo.
export function comandoPara(op: OperacaoOutbox): OutboxCommand {
  switch (op.tipo) {
    case 'PESSOA':
      return new UpsertCommand(op, db.pessoas, remoto.pessoas);
    case 'PRONTUARIO':
      return new UpsertCommand(op, db.prontuarios, remoto.prontuarios);
    case 'ATENDIMENTO':
      return new UpsertCommand(op, db.atendimentos, remoto.atendimentos);
  }
}
