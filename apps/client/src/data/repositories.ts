/**
 * Padrão Repository: as telas e o SyncEngine pedem dados aos repositórios, sem saber
 * se vêm do banco embarcado (Dexie) ou da API REST da central.
 */
import type { Table } from 'dexie';
import type { UpsertResponse } from '@medicalfield/shared';
import { api } from '../api/client';
import { db, type AtendimentoLocal, type PessoaLocal, type ProntuarioLocal } from './db';

export interface Repository<T> {
  buscar(id: string): Promise<T | undefined>;
  listar(): Promise<T[]>;
}

class LocalRepository<T> implements Repository<T> {
  constructor(protected readonly tabela: Table<T, string>) {}
  async buscar(id: string) {
    return this.tabela.get(id);
  }
  async listar() {
    return this.tabela.toArray();
  }
}

class PessoasLocais extends LocalRepository<PessoaLocal> {
  async listar() {
    return (await this.tabela.toArray()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}

class ProntuariosLocais extends LocalRepository<ProntuarioLocal> {
  daPessoa(pessoaId: string) {
    return this.tabela.where('pessoaId').equals(pessoaId).first();
  }
}

class AtendimentosLocais extends LocalRepository<AtendimentoLocal> {
  async listar() {
    return this.tabela.orderBy('dataHora').reverse().toArray();
  }
  async daPessoa(pessoaId: string) {
    return (await this.tabela.where('pessoaId').equals(pessoaId).toArray()).sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  }
}

export const local = {
  pessoas: new PessoasLocais(db.pessoas),
  prontuarios: new ProntuariosLocais(db.prontuarios),
  atendimentos: new AtendimentosLocais(db.atendimentos),
  medicamentos: new LocalRepository(db.medicamentos),
};

/** Repositório remoto: upsert idempotente (o opId da Outbox vai como Idempotency-Key). */
class RemoteRepository<T> {
  constructor(private readonly rota: string) {}
  salvar(registro: unknown, opId: string) {
    return api<UpsertResponse<T>>('POST', this.rota, registro, opId);
  }
}

export const remoto = {
  pessoas: new RemoteRepository<PessoaLocal>('/pessoa'),
  prontuarios: new RemoteRepository<ProntuarioLocal>('/prontuario'),
  atendimentos: new RemoteRepository<AtendimentoLocal>('/atendimento'),
};
