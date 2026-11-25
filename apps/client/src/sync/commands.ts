/**
 * PADRÃO COMMAND — "a comanda do restaurante"
 *
 * Tudo que é salvo offline vira um pedido guardado numa fila (a Outbox, no IndexedDB).
 * Quando a internet volta, o SyncEngine pega cada pedido e chama execute().
 * Deu erro de rede? O pedido fica na fila e é executado de novo depois.
 * Reenviar não duplica: cada pedido leva o seu opId como Idempotency-Key.
 */
// Table: o tipo de uma tabela do banco do aparelho (Dexie/IndexedDB).
import type { Table } from 'dexie';
// db: o banco do aparelho. OperacaoOutbox: um item da fila (opId, tipo, entidadeId, status).
import { db, type OperacaoOutbox } from '../data/db';
// remoto: os repositórios da central (Repository), que fazem o POST na API.
import { remoto } from '../data/repositories';

// O CONTRATO
// Um comando é qualquer objeto que sabe se executar. Quem executa (o SyncEngine) não precisa
// saber se é uma pessoa, um prontuário ou um atendimento.
export interface OutboxCommand {
  // Executa o pedido (enviar para a central). É assíncrono porque depende da rede.
  execute(): Promise<void>;
}

// O COMANDO
// Guarda o pedido da fila (op), a tabela do aparelho e o destino na central.
// Ele envia o estado ATUAL do registro: se a pessoa foi editada 3 vezes offline, vai a última versão.
// "Upsert" = cria se não existe, atualiza se já existe.
class UpsertCommand<L extends { id: string; version?: number; syncStatus: string }> implements OutboxCommand {
  constructor(
    // O item da fila: diz qual registro enviar (entidadeId) e a chave do envio (opId).
    private readonly op: OperacaoOutbox,
    // A tabela do aparelho onde o registro está guardado (ex.: db.pessoas).
    private readonly tabela: Table<L, string>,
    // Para onde enviar: o repositório remoto (ex.: remoto.pessoas → POST /pessoa).
    private readonly destino: { salvar(registro: unknown, opId: string): Promise<{ registro: unknown }> },
  ) {}

  // EXECUTAR: 1) pega o registro no aparelho  2) envia à central com a baseVersion (para detectar
  // conflito)  3) grava a resposta da central no aparelho, marcada como SINCRONIZADO.
  async execute() {
    // 1) Lê o registro atual no aparelho.
    const registro = await this.tabela.get(this.op.entidadeId);
    // Se o registro não existe mais, não há o que enviar.
    if (!registro) return;
    // Separa os campos que são só do aparelho (syncStatus, version) dos dados que vão para a central.
    const { syncStatus: _s, version, ...dados } = registro as L & { syncErro?: unknown };
    // Tira também a mensagem de erro de envio, que só existe no aparelho.
    delete (dados as { syncErro?: unknown }).syncErro;
    // 2) Envia. baseVersion = a versão que o aparelho conhecia (a central usa para ver se houve conflito).
    const r = await this.destino.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
    // 3) Guarda no aparelho o que a central devolveu (versão nova, ou mesclada), como SINCRONIZADO.
    await this.tabela.put({ ...(r.registro as L), syncStatus: 'SINCRONIZADO' });
  }
}

// A FÁBRICA
// Lê o tipo do item da fila e monta o comando certo, já ligado à tabela e à rota da API certas.
// O SyncEngine só faz: comandoPara(item).execute().
export function comandoPara(op: OperacaoOutbox): OutboxCommand {
  // Olha o tipo do pedido...
  switch (op.tipo) {
    // Pessoa: lê de db.pessoas e envia para POST /pessoa.
    case 'PESSOA':
      return new UpsertCommand(op, db.pessoas, remoto.pessoas);
    // Prontuário: lê de db.prontuarios e envia para POST /prontuario.
    case 'PRONTUARIO':
      return new UpsertCommand(op, db.prontuarios, remoto.prontuarios);
    // Atendimento: lê de db.atendimentos e envia para POST /atendimento.
    case 'ATENDIMENTO':
      return new UpsertCommand(op, db.atendimentos, remoto.atendimentos);
  }
}
