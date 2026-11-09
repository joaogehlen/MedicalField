/**
 * Banco embarcado do dispositivo (IndexedDB via Dexie). Toda escrita do cliente cai
 * aqui primeiro; a Outbox guarda as operações a enviar ao servidor.
 */
import Dexie, { type Table } from 'dexie';
import type {
  Atendimento,
  Hospital,
  LogCliente,
  Medicamento,
  Pessoa,
  Prontuario,
  Viatura,
} from '@medicalfield/shared';

export type SyncStatus = 'PENDENTE' | 'SINCRONIZADO' | 'ERRO';

export interface Local {
  syncStatus: SyncStatus;
  syncErro?: string | null;
}

export type PessoaLocal = Pessoa & Local;
export type ProntuarioLocal = Prontuario & Local;
export type AtendimentoLocal = Atendimento & Local;

export type TipoOperacao = 'UPSERT_PESSOA' | 'UPSERT_PRONTUARIO' | 'UPSERT_ATENDIMENTO';
export type StatusOperacao = 'PENDENTE' | 'ENVIANDO' | 'CONCLUIDO' | 'ERRO';

/** Item da Outbox: um Command serializado, reexecutável e idempotente (opId). */
export interface OperacaoOutbox {
  seq?: number;
  opId: string;
  tipo: TipoOperacao;
  entidadeId: string;
  /** Snapshot do registro quando a operação foi criada (auditoria). */
  payload: unknown;
  status: StatusOperacao;
  tentativas: number;
  ultimoErro?: string | null;
  criadoEm: string;
  concluidoEm?: string | null;
}

export interface LogLocal extends LogCliente {
  enviado: 0 | 1;
}

export interface CredencialOffline {
  chave: string;
  salt: string;
  hash: string;
  profissional: import('@medicalfield/shared').Profissional;
  refreshToken: string | null;
  atualizadoEm: string;
}

export interface Meta {
  chave: string;
  valor: unknown;
}

export class MedicalFieldDB extends Dexie {
  pessoas!: Table<PessoaLocal, string>;
  prontuarios!: Table<ProntuarioLocal, string>;
  atendimentos!: Table<AtendimentoLocal, string>;
  medicamentos!: Table<Medicamento, string>;
  hospitais!: Table<Hospital, string>;
  viaturas!: Table<Viatura, string>;
  outbox!: Table<OperacaoOutbox, number>;
  logsLocais!: Table<LogLocal, string>;
  credenciais!: Table<CredencialOffline, string>;
  meta!: Table<Meta, string>;

  constructor(nome = 'medicalfield') {
    super(nome);
    this.version(1).stores({
      pessoas: 'id, cpf, nome, syncStatus, mescladaEm',
      prontuarios: 'id, pessoaId, syncStatus',
      atendimentos: 'id, pessoaId, prontuarioId, status, syncStatus, iniciadoEm',
      medicamentos: 'id, nome, ativo',
      hospitais: 'id, nome',
      viaturas: 'id, prefixo',
      outbox: '++seq, &opId, status, tipo, entidadeId',
      logsLocais: 'id, enviado, dataHora',
      credenciais: 'chave',
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
