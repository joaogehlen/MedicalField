/**
 * Padrão Repository: a interface gráfica e o SyncEngine pedem dados a repositórios,
 * sem saber se vêm do banco embarcado (Dexie) ou da API REST da central.
 */
import type { Table } from 'dexie';
import type { Atendimento, Hospital, Medicamento, Pessoa, Prontuario, UpsertResponse, Viatura } from '@medicalfield/shared';
import { api } from '../api/client';
import { db, type AtendimentoLocal, type PessoaLocal, type ProntuarioLocal } from './db';

export interface Repository<T, ID = string> {
  buscar(id: ID): Promise<T | undefined>;
  listar(): Promise<T[]>;
}

/* --------------------------------- Locais --------------------------------- */

class LocalRepository<T> implements Repository<T> {
  constructor(protected readonly tabela: Table<T, string>) {}
  async buscar(id: string): Promise<T | undefined> {
    return this.tabela.get(id);
  }
  async listar(): Promise<T[]> {
    return this.tabela.toArray();
  }
}

class PessoasLocais extends LocalRepository<PessoaLocal> {
  /** Pessoas visíveis (as mescladas em outra ficam ocultas). */
  async listar() {
    return (await this.tabela.toArray()).filter((p) => !p.mescladaEm).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}

class ProntuariosLocais extends LocalRepository<ProntuarioLocal> {
  async daPessoa(pessoaId: string) {
    return (await this.tabela.where('pessoaId').equals(pessoaId).toArray()).find((p) => !p.mescladoEm);
  }
}

class AtendimentosLocais extends LocalRepository<AtendimentoLocal> {
  /** Ocorrências mais recentes primeiro. */
  async listar() {
    return (await this.tabela.orderBy('iniciadoEm').reverse().toArray()).filter((a) => !('excluido' in a && a.excluido));
  }
  daPessoa(pessoaId: string) {
    return this.tabela.where('pessoaId').equals(pessoaId).reverse().sortBy('iniciadoEm');
  }
}

class CatalogoLocal extends LocalRepository<Medicamento> {
  async ativos() {
    return (await this.tabela.toArray()).filter((m) => m.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}

export const local = {
  pessoas: new PessoasLocais(db.pessoas),
  prontuarios: new ProntuariosLocais(db.prontuarios),
  atendimentos: new AtendimentosLocais(db.atendimentos),
  medicamentos: new CatalogoLocal(db.medicamentos),
  hospitais: new LocalRepository<Hospital>(db.hospitais),
  viaturas: new LocalRepository<Viatura>(db.viaturas),
};

/* --------------------------------- Remotos -------------------------------- */

class RemoteRepository<T extends { id: string }> implements Repository<T> {
  constructor(private readonly rota: string, private readonly rotaDetalhe = rota) {}

  buscar(id: string) {
    return api<T>('GET', `${this.rotaDetalhe}/${id}`);
  }

  async listar() {
    const r = await api<T[] | { itens: T[] }>('GET', this.rota);
    return Array.isArray(r) ? r : r.itens;
  }

  /** Upsert idempotente: o opId da Outbox vai como Idempotency-Key. */
  salvar(registro: unknown, opId: string) {
    return api<UpsertResponse<T>>('POST', this.rota, registro, { idempotencyKey: opId });
  }
}

export const remoto = {
  pessoas: new RemoteRepository<Pessoa>('/pessoa'),
  prontuarios: new RemoteRepository<Prontuario>('/prontuario'),
  atendimentos: new RemoteRepository<Atendimento>('/atendimento', '/atendimento/detalhe'),
};
