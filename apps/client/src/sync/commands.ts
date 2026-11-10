/**
 * Padrão Command: cada item da Outbox vira um comando executável. A execução envia o
 * estado atual do registro com o opId como Idempotency-Key, então reenviar não duplica.
 */
import type { Table } from 'dexie';
import { db, type OperacaoOutbox } from '../data/db';
import { remoto } from '../data/repositories';

export interface OutboxCommand {
  execute(): Promise<void>;
}

class UpsertCommand<L extends { id: string; version?: number; syncStatus: string }> implements OutboxCommand {
  constructor(
    private readonly op: OperacaoOutbox,
    private readonly tabela: Table<L, string>,
    private readonly destino: { salvar(registro: unknown, opId: string): Promise<{ registro: unknown }> },
  ) {}

  async execute() {
    const registro = await this.tabela.get(this.op.entidadeId);
    if (!registro) return;
    const { syncStatus: _s, version, ...dados } = registro as L & { syncErro?: unknown };
    delete (dados as { syncErro?: unknown }).syncErro;
    const r = await this.destino.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
    await this.tabela.put({ ...(r.registro as L), syncStatus: 'SINCRONIZADO' });
  }
}

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
