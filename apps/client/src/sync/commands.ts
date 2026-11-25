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

// O CONTRATO
// Um comando é qualquer objeto que sabe se executar. Quem executa (o SyncEngine) não precisa
// saber se é uma pessoa, um prontuário ou um atendimento.
export interface OutboxCommand {
  execute(): Promise<void>;
}

// O COMANDO
// Guarda o pedido da fila (op), a tabela do aparelho e o destino na central.
// Ele envia o estado ATUAL do registro: se a pessoa foi editada 3 vezes offline, vai a última versão.
class UpsertCommand<L extends { id: string; version?: number; syncStatus: string }> implements OutboxCommand {
  constructor(
    private readonly op: OperacaoOutbox,
    private readonly tabela: Table<L, string>,
    private readonly destino: { salvar(registro: unknown, opId: string): Promise<{ registro: unknown }> },
  ) {}

  // EXECUTAR: 1) pega o registro no aparelho  2) envia à central com a baseVersion (para detectar
  // conflito)  3) grava a resposta da central no aparelho, marcada como SINCRONIZADO.
  async execute() {
    const registro = await this.tabela.get(this.op.entidadeId);
    if (!registro) return;
    const { syncStatus: _s, version, ...dados } = registro as L & { syncErro?: unknown };
    delete (dados as { syncErro?: unknown }).syncErro;
    const r = await this.destino.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
    await this.tabela.put({ ...(r.registro as L), syncStatus: 'SINCRONIZADO' });
  }
}

// A FÁBRICA
// Lê o tipo do item da fila e monta o comando certo, já ligado à tabela e à rota da API certas.
// O SyncEngine só faz: comandoPara(item).execute().
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
