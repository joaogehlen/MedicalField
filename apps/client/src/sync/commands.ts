/**
 * Padrão Command: cada item da Outbox vira um comando executável. A execução envia o
 * estado MAIS RECENTE do registro local (não o snapshot), com o opId como
 * Idempotency-Key — reenviar nunca duplica, e edições feitas depois são incluídas.
 */
import type { Table } from 'dexie';
import type { Atendimento, Pessoa, Prontuario, UpsertResponse } from '@medicalfield/shared';
import { db, type AtendimentoLocal, type OperacaoOutbox, type PessoaLocal, type ProntuarioLocal } from '../data/db';
import { remoto } from '../data/repositories';

export interface OutboxCommand {
  readonly op: OperacaoOutbox;
  execute(): Promise<void>;
}

type Registro = { id: string; version?: number; changeSeq?: number };

abstract class UpsertCommand<T extends Registro, L extends T & { syncStatus: string }> implements OutboxCommand {
  protected abstract readonly tabela: Table<L, string>;
  protected abstract readonly remoto: { salvar(registro: unknown, opId: string): Promise<UpsertResponse<T>> };

  constructor(readonly op: OperacaoOutbox) {}

  async execute() {
    const local = await this.tabela.get(this.op.entidadeId);
    if (!local) return; // removido localmente: nada a enviar
    const { syncStatus: _s, syncErro: _e, version, changeSeq: _c, ...dados } = local as L & { syncErro?: string };
    const resposta = await this.remoto.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
    await this.aplicar(resposta);
  }

  /** Grava o que o servidor devolveu (versão, mescla). Preserva edições locais ainda não enviadas. */
  protected async aplicar(r: UpsertResponse<T>) {
    const outraPendente = await db.outbox
      .where('entidadeId')
      .equals(this.op.entidadeId)
      .filter((o) => o.seq !== this.op.seq && o.status === 'PENDENTE')
      .count();
    if (outraPendente) {
      await this.tabela.update(this.op.entidadeId, { version: r.registro.version, changeSeq: r.registro.changeSeq } as never);
      return;
    }
    await this.tabela.put({ ...r.registro, syncStatus: 'SINCRONIZADO', syncErro: null } as unknown as L);
  }
}

export class UpsertPessoaCommand extends UpsertCommand<Pessoa, PessoaLocal> {
  protected readonly tabela = db.pessoas;
  protected readonly remoto = remoto.pessoas;

  protected async aplicar(r: UpsertResponse<Pessoa>) {
    if (r.resultado !== 'MESCLADO_EM' || !r.idCanonico) return super.aplicar(r);
    // A mesma vítima já existia na central (mesmo CPF): passa a usar o registro canônico.
    const antigo = this.op.entidadeId;
    await db.transaction('rw', db.pessoas, db.prontuarios, db.atendimentos, async () => {
      await db.pessoas.put({ ...r.registro, syncStatus: 'SINCRONIZADO', syncErro: null });
      await db.pessoas.update(antigo, { mescladaEm: r.idCanonico, syncStatus: 'SINCRONIZADO' });
      await db.prontuarios.where('pessoaId').equals(antigo).modify({ pessoaId: r.idCanonico });
      await db.atendimentos.where('pessoaId').equals(antigo).modify({ pessoaId: r.idCanonico });
    });
  }
}

export class UpsertProntuarioCommand extends UpsertCommand<Prontuario, ProntuarioLocal> {
  protected readonly tabela = db.prontuarios;
  protected readonly remoto = remoto.prontuarios;

  protected async aplicar(r: UpsertResponse<Prontuario>) {
    if (r.resultado !== 'MESCLADO_EM' || !r.idCanonico) return super.aplicar(r);
    const antigo = this.op.entidadeId;
    await db.transaction('rw', db.prontuarios, db.atendimentos, async () => {
      await db.prontuarios.put({ ...r.registro, syncStatus: 'SINCRONIZADO', syncErro: null });
      await db.prontuarios.update(antigo, { mescladoEm: r.idCanonico, syncStatus: 'SINCRONIZADO' });
      await db.atendimentos.where('prontuarioId').equals(antigo).modify({ prontuarioId: r.idCanonico });
    });
  }
}

export class UpsertAtendimentoCommand extends UpsertCommand<Atendimento, AtendimentoLocal> {
  protected readonly tabela = db.atendimentos;
  protected readonly remoto = remoto.atendimentos;
}

export function comandoPara(op: OperacaoOutbox): OutboxCommand {
  switch (op.tipo) {
    case 'UPSERT_PESSOA':
      return new UpsertPessoaCommand(op);
    case 'UPSERT_PRONTUARIO':
      return new UpsertProntuarioCommand(op);
    case 'UPSERT_ATENDIMENTO':
      return new UpsertAtendimentoCommand(op);
  }
}
