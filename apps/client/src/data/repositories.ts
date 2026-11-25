/**
 * PADRÃO REPOSITORY — "o balcão do almoxarifado"
 *
 * A tela pede "me dá a pessoa X" e não sabe onde ela está guardada.
 *   local.*  → banco do próprio aparelho (IndexedDB): funciona sem internet
 *   remoto.* → API da central (HTTP)
 * Trocar o jeito de guardar = mexer só neste arquivo; as telas continuam iguais.
 */
// Table: o tipo de uma tabela do Dexie (a biblioteca que facilita usar o IndexedDB do navegador).
import type { Table } from 'dexie';
// UpsertResponse: o formato da resposta da API ao salvar ({ resultado, registro }).
import type { UpsertResponse } from '@medicalfield/shared';
// api: a função que faz as requisições HTTP para a central (já coloca o token no cabeçalho).
import { api } from '../api/client';
// db: o banco do aparelho, com as tabelas pessoas, prontuarios, atendimentos e medicamentos.
import { db, type AtendimentoLocal, type PessoaLocal, type ProntuarioLocal } from './db';

// O CONTRATO
// Todo repositório sabe fazer duas coisas: buscar um registro pelo id e listar todos.
// A tela só conhece estes dois métodos; não sabe se por trás tem IndexedDB, API ou outra coisa.
// <T> = "de qualquer tipo": serve para Pessoa, Prontuário, Atendimento...
export interface Repository<T> {
  // buscar: recebe o id e devolve o registro (ou undefined, se não existir).
  buscar(id: string): Promise<T | undefined>;
  // listar: devolve todos os registros.
  listar(): Promise<T[]>;
}

// O REPOSITÓRIO LOCAL
// Recebe uma tabela do IndexedDB (o banco do navegador) e implementa o contrato em cima dela:
// buscar = tabela.get(id), listar = tabela.toArray(). Funciona sem internet, porque é tudo no aparelho.
// "implements Repository<T>" = promete cumprir o contrato acima.
class LocalRepository<T> implements Repository<T> {
  // Guarda a tabela que este repositório vai usar (ex.: db.pessoas).
  constructor(protected readonly tabela: Table<T, string>) {}
  // Busca um registro pelo id dentro da tabela do aparelho.
  async buscar(id: string) {
    return this.tabela.get(id);
  }
  // Devolve todos os registros da tabela do aparelho.
  async listar() {
    return this.tabela.toArray();
  }
}

// REPOSITÓRIOS ESPECIALIZADOS
// Herdam o repositório local e mudam só o que precisam: pessoas vêm em ordem alfabética,
// prontuários ganham "daPessoa" e atendimentos vêm do mais novo para o mais antigo.
// "extends LocalRepository" = herda buscar() e listar() prontos.
class PessoasLocais extends LocalRepository<PessoaLocal> {
  // Troca o listar(): pega todas as pessoas e ordena pelo nome (A → Z, regras do português).
  async listar() {
    return (await this.tabela.toArray()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
}

class ProntuariosLocais extends LocalRepository<ProntuarioLocal> {
  // Método extra: procura o prontuário de uma pessoa (cada pessoa tem um prontuário).
  daPessoa(pessoaId: string) {
    return this.tabela.where('pessoaId').equals(pessoaId).first();
  }
}

class AtendimentosLocais extends LocalRepository<AtendimentoLocal> {
  // Troca o listar(): atendimentos ordenados pela data, do mais novo para o mais antigo.
  async listar() {
    return this.tabela.orderBy('dataHora').reverse().toArray();
  }
  // Método extra: todos os atendimentos de uma pessoa, do mais novo para o mais antigo.
  async daPessoa(pessoaId: string) {
    return (await this.tabela.where('pessoaId').equals(pessoaId).toArray()).sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  }
}

// O QUE AS TELAS USAM
// Um repositório pronto para cada tabela. A tela chama, por exemplo, local.pessoas.listar()
// e recebe a lista, sem nenhuma linha de código de banco de dados.
export const local = {
  // Pacientes (vítimas), em ordem alfabética.
  pessoas: new PessoasLocais(db.pessoas),
  // Prontuários (tipo sanguíneo, alergias, comorbidades).
  prontuarios: new ProntuariosLocais(db.prontuarios),
  // Atendimentos, do mais novo para o mais antigo.
  atendimentos: new AtendimentosLocais(db.atendimentos),
  // Catálogo de medicamentos: não precisa de nada especial, usa o repositório local puro.
  medicamentos: new LocalRepository(db.medicamentos),
};

// O REPOSITÓRIO REMOTO (a central)
// Salvar = um POST na API. O opId vai como Idempotency-Key: se a internet cair no meio e o
// mesmo envio for repetido, a central reconhece a chave e não grava duas vezes.
class RemoteRepository<T> {
  // Guarda a rota da API deste repositório (ex.: '/pessoa').
  constructor(private readonly rota: string) {}
  // Envia o registro para a central: POST na rota, com o opId como Idempotency-Key.
  salvar(registro: unknown, opId: string) {
    return api<UpsertResponse<T>>('POST', this.rota, registro, opId);
  }
}

// Quem usa o remoto é só o envio para a central (commands.ts). As telas nunca chamam a API direto.
export const remoto = {
  // POST /api/pessoa
  pessoas: new RemoteRepository<PessoaLocal>('/pessoa'),
  // POST /api/prontuario
  prontuarios: new RemoteRepository<ProntuarioLocal>('/prontuario'),
  // POST /api/atendimento
  atendimentos: new RemoteRepository<AtendimentoLocal>('/atendimento'),
};
