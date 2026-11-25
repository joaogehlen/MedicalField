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

// O CONTRATO
// Todo repositório sabe fazer duas coisas: buscar um registro pelo id e listar todos.
// A tela só conhece estes dois métodos; não sabe se por trás tem IndexedDB, API ou outra coisa.
export interface Repository<T> {
  buscar(id: string): Promise<T | undefined>;
  listar(): Promise<T[]>;
}

// O REPOSITÓRIO LOCAL
// Recebe uma tabela do IndexedDB (o banco do navegador) e implementa o contrato em cima dela:
// buscar = tabela.get(id), listar = tabela.toArray(). Funciona sem internet, porque é tudo no aparelho.
class LocalRepository<T> implements Repository<T> {
  constructor(protected readonly tabela: Table<T, string>) {}
  async buscar(id: string) {
    return this.tabela.get(id);
  }
  async listar() {
    return this.tabela.toArray();
  }
}

// REPOSITÓRIOS ESPECIALIZADOS
// Herdam o repositório local e mudam só o que precisam: pessoas vêm em ordem alfabética,
// prontuários ganham "daPessoa" e atendimentos vêm do mais novo para o mais antigo.
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

// O QUE AS TELAS USAM
// Um repositório pronto para cada tabela. A tela chama, por exemplo, local.pessoas.listar()
// e recebe a lista, sem nenhuma linha de código de banco de dados.
export const local = {
  pessoas: new PessoasLocais(db.pessoas),
  prontuarios: new ProntuariosLocais(db.prontuarios),
  atendimentos: new AtendimentosLocais(db.atendimentos),
  medicamentos: new LocalRepository(db.medicamentos),
};

// O REPOSITÓRIO REMOTO (a central)
// Salvar = um POST na API. O opId vai como Idempotency-Key: se a internet cair no meio e o
// mesmo envio for repetido, a central reconhece a chave e não grava duas vezes.
class RemoteRepository<T> {
  constructor(private readonly rota: string) {}
  salvar(registro: unknown, opId: string) {
    return api<UpsertResponse<T>>('POST', this.rota, registro, opId);
  }
}

// Quem usa o remoto é só o envio para a central (commands.ts). As telas nunca chamam a API direto.
export const remoto = {
  pessoas: new RemoteRepository<PessoaLocal>('/pessoa'),
  prontuarios: new RemoteRepository<ProntuarioLocal>('/prontuario'),
  atendimentos: new RemoteRepository<AtendimentoLocal>('/atendimento'),
};
