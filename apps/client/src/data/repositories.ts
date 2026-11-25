/**
 * PADRÃO REPOSITORY — "o balcão do almoxarifado"
 *
 * A tela pede "me dá a pessoa X" e não sabe onde ela está guardada.
 *   local.*  → banco do próprio aparelho (IndexedDB): funciona sem internet
 *   remoto.* → API da central (HTTP)
 * Trocar o jeito de guardar = mexer só neste arquivo; as telas continuam iguais.
 */
import type { Table } from 'dexie';
import type { UpsertResponse } from '@medicalfield/shared';
import { api } from '../api/client';
import { db, type AtendimentoLocal, type PessoaLocal, type ProntuarioLocal } from './db';

// O contrato: todo repositório sabe buscar e listar.
export interface Repository<T> {
  buscar(id: string): Promise<T | undefined>;
  listar(): Promise<T[]>;
}

// Qualquer tabela do IndexedDB vira um repositório.
class LocalRepository<T> implements Repository<T> {
  constructor(protected readonly tabela: Table<T, string>) {}
  async buscar(id: string) {
    return this.tabela.get(id);
  }
  async listar() {
    return this.tabela.toArray();
  }
}

// Cada repositório pode ganhar o seu "jeito" sem a tela saber: pessoas vêm em ordem alfabética.
class PessoasLocais extends LocalRepository<PessoaLocal> {
  async listar() {
    return (await this.tabela.toArray()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}

// Busca extra: o prontuário de uma pessoa.
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

// O que as telas usam: local.pessoas.listar(), local.prontuarios.daPessoa(id)...
export const local = {
  pessoas: new PessoasLocais(db.pessoas),
  prontuarios: new ProntuariosLocais(db.prontuarios),
  atendimentos: new AtendimentosLocais(db.atendimentos),
  medicamentos: new LocalRepository(db.medicamentos),
};

// Repositório da central: um POST na API. O opId vai como Idempotency-Key (reenviar não duplica).
class RemoteRepository<T> {
  constructor(private readonly rota: string) {}
  salvar(registro: unknown, opId: string) {
    return api<UpsertResponse<T>>('POST', this.rota, registro, opId);
  }
}

// Usado só pelo envio para a central (commands.ts). As telas nunca chamam a API direto.
export const remoto = {
  pessoas: new RemoteRepository<PessoaLocal>('/pessoa'),
  prontuarios: new RemoteRepository<ProntuarioLocal>('/prontuario'),
  atendimentos: new RemoteRepository<AtendimentoLocal>('/atendimento'),
};
