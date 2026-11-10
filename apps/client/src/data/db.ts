/**
 * Banco embarcado do aparelho (IndexedDB via Dexie). Toda escrita cai aqui primeiro;
 * a Outbox guarda as operações que ainda vão para a central.
 */
import Dexie, { type Table } from 'dexie';
import type { Atendimento, LogCliente, Medicamento, Pessoa, Prontuario } from '@medicalfield/shared';

export type SyncStatus = 'PENDENTE' | 'SINCRONIZADO' | 'ERRO';

export interface Local {
  syncStatus: SyncStatus;
  syncErro?: string | null;
}

export type PessoaLocal = Pessoa & Local;
export type ProntuarioLocal = Prontuario & Local;
export type AtendimentoLocal = Atendimento & Local;

export type TipoOperacao = 'PESSOA' | 'PRONTUARIO' | 'ATENDIMENTO';

/** Item da Outbox: um Command reexecutável; o opId vai como Idempotency-Key. */
export interface OperacaoOutbox {
  seq?: number;
  opId: string;
  tipo: TipoOperacao;
  entidadeId: string;
  status: 'PENDENTE' | 'CONCLUIDO' | 'ERRO';
  erro?: string | null;
  criadoEm: string;
}

export interface LogLocal extends LogCliente {
  enviado: 0 | 1;
}

export class MedicalFieldDB extends Dexie {
  pessoas!: Table<PessoaLocal, string>;
  prontuarios!: Table<ProntuarioLocal, string>;
  atendimentos!: Table<AtendimentoLocal, string>;
  medicamentos!: Table<Medicamento, string>;
  outbox!: Table<OperacaoOutbox, number>;
  logsLocais!: Table<LogLocal, string>;
  meta!: Table<{ chave: string; valor: unknown }, string>;

  constructor() {
    super('medicalfield-v2');
    this.version(1).stores({
      pessoas: 'id, nome',
      prontuarios: 'id, pessoaId',
      atendimentos: 'id, pessoaId, dataHora',
      medicamentos: 'id, nome',
      outbox: '++seq, status, entidadeId',
      logsLocais: 'id, enviado',
      meta: 'chave',
    });
  }

  async lerMeta<T>(chave: string, padrao: T): Promise<T> {
    return ((await this.meta.get(chave))?.valor as T | undefined) ?? padrao;
  }

  gravarMeta(chave: string, valor: unknown) {
    return this.meta.put({ chave, valor });
  }
}

export const db = new MedicalFieldDB();
