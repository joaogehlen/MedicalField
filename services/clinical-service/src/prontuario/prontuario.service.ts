import { HttpStatus, Injectable } from '@nestjs/common';
import type { Page, Prontuario, ProntuarioInput, ProntuarioResumo, UpsertResponse } from '@medicalfield/shared';
import { DatabaseService, type Db } from '../db/database.service';
import { pessoaCanonica } from '../common/aliases';
import { ApiError } from '../common/errors';
import { prontuarioDeLinha } from '../common/mappers';
import { FieldMergeStrategy } from '../sync/strategies';
import { houveConflito, SyncSupport, type ContextoEscrita, type RespostaGravada } from '../sync/sync-support';

const SELECT_RESUMO = `
  SELECT pr.*, pe.nome AS pessoa_nome, pe.cpf AS pessoa_cpf, pe.data_nascimento AS pessoa_nascimento,
         pe.identificada AS pessoa_identificada, pe.sexo AS pessoa_sexo,
         (SELECT count(*)::int FROM atendimento a WHERE a.prontuario_id = pr.id AND NOT a.excluido) AS total_atendimentos
  FROM prontuario pr JOIN pessoa pe ON pe.id = pr.pessoa_id`;

function resumoDeLinha(r: Record<string, any>): ProntuarioResumo {
  return {
    ...prontuarioDeLinha(r),
    pessoa: {
      id: r.pessoa_id,
      nome: r.pessoa_nome,
      cpf: r.pessoa_cpf,
      dataNascimento: r.pessoa_nascimento,
      identificada: r.pessoa_identificada,
      sexo: r.pessoa_sexo,
    },
    totalAtendimentos: r.total_atendimentos,
  };
}

@Injectable()
export class ProntuarioService {
  /** Escalares por last-write-wins; listas clínicas por união (alergia nunca se perde). */
  private readonly merge = new FieldMergeStrategy<Prontuario>(
    ['tipoSanguineo', 'observacoes'],
    ['alergias', 'comorbidades', 'medicamentosUsoContinuo'],
  );

  constructor(private readonly db: DatabaseService, private readonly sync: SyncSupport) {}

  async listar(f: { pessoaId?: string; busca?: string }, pagina: number, tamanho: number, offset: number): Promise<Page<ProntuarioResumo>> {
    const where = `WHERE pr.mesclado_em IS NULL AND NOT pr.excluido
      AND ($1::uuid IS NULL OR pr.pessoa_id = $1) AND ($2::text IS NULL OR pe.nome ILIKE $2 OR pe.cpf LIKE $3)`;
    const busca = f.busca?.trim() ? `%${f.busca.trim()}%` : null;
    const digitos = busca ? `%${busca.replace(/\D/g, '')}%` : null;
    const args = [f.pessoaId ?? null, busca, digitos === '%%' ? null : digitos];
    const total = await this.db.one<{ n: number }>(
      `SELECT count(*)::int n FROM prontuario pr JOIN pessoa pe ON pe.id = pr.pessoa_id ${where}`,
      args,
    );
    const linhas = await this.db.query(`${SELECT_RESUMO} ${where} ORDER BY pr.atualizado_em DESC LIMIT $4 OFFSET $5`, [
      ...args,
      tamanho,
      offset,
    ]);
    return { itens: linhas.map(resumoDeLinha), pagina, tamanho, total: total?.n ?? 0 };
  }

  async obter(id: string): Promise<ProntuarioResumo> {
    const r = await this.db.one(`${SELECT_RESUMO} WHERE pr.id = $1`, [id]);
    if (!r) throw ApiError.naoEncontrado('Prontuário');
    return resumoDeLinha(r);
  }

  upsert(input: ProntuarioInput, ctx: ContextoEscrita) {
    return this.sync.executar(ctx, 'PRONTUARIO', input.id, (tx) => this.gravar(tx, input, ctx));
  }

  private async gravar(tx: Db, input: ProntuarioInput, ctx: ContextoEscrita): Promise<RespostaGravada> {
    const pessoaId = await pessoaCanonica(tx, input.pessoaId);
    if (!pessoaId) throw ApiError.dependenciaAusente('A pessoa deste prontuário ainda não foi sincronizada.');
    const recebido: Prontuario = { ...input, pessoaId };
    const linha = await tx.one('SELECT * FROM prontuario WHERE id = $1 FOR UPDATE', [input.id]);

    if (!linha) {
      const daPessoa = await tx.one('SELECT * FROM prontuario WHERE pessoa_id = $1 AND mesclado_em IS NULL FOR UPDATE', [pessoaId]);
      if (daPessoa) {
        // A pessoa já tem prontuário (criado por outra equipe): mescla nele.
        const canonico = prontuarioDeLinha(daPessoa);
        const salvo = await this.atualizar(tx, this.merge.resolve(canonico, { ...recebido, id: canonico.id }), ctx);
        await this.inserir(tx, recebido, ctx, canonico.id);
        await this.sync.registrarConflito(tx, ctx, {
          entidade: 'PRONTUARIO', entidadeId: canonico.id, estrategia: this.merge.nome, versaoServidor: canonico.version!,
          versaoBaseCliente: null, valorServidor: canonico, valorRecebido: recebido, valorResultante: salvo,
        });
        return resposta(HttpStatus.OK, { resultado: 'MESCLADO_EM', registro: salvo, idCanonico: canonico.id });
      }
      return resposta(HttpStatus.CREATED, { resultado: 'CRIADO', registro: await this.inserir(tx, recebido, ctx, null) });
    }

    const servidor = prontuarioDeLinha(linha);
    if (!houveConflito(servidor.version!, input.baseVersion)) {
      return resposta(HttpStatus.OK, { resultado: 'ATUALIZADO', registro: await this.atualizar(tx, recebido, ctx) });
    }
    const salvo = await this.atualizar(tx, this.merge.resolve(servidor, recebido), ctx);
    await this.sync.registrarConflito(tx, ctx, {
      entidade: 'PRONTUARIO', entidadeId: servidor.id, estrategia: this.merge.nome, versaoServidor: servidor.version!,
      versaoBaseCliente: input.baseVersion, valorServidor: servidor, valorRecebido: recebido, valorResultante: salvo,
    });
    return resposta(HttpStatus.OK, { resultado: 'MESCLADO', registro: salvo });
  }

  private async inserir(tx: Db, p: Prontuario, ctx: ContextoEscrita, mescladoEm: string | null): Promise<Prontuario> {
    const r = await tx.one(
      `INSERT INTO prontuario (id, pessoa_id, tipo_sanguineo, alergias, comorbidades, medicamentos_uso_continuo, observacoes,
         mesclado_em, atualizado_em_cliente, registrado_por, sincronizado_por, dispositivo_id, criado_offline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [p.id, p.pessoaId, p.tipoSanguineo, p.alergias, p.comorbidades, p.medicamentosUsoContinuo, p.observacoes, mescladoEm,
        p.atualizadoEmCliente, p.registradoPor, ctx.profissionalId, p.dispositivoId, p.criadoOffline ?? false],
    );
    return prontuarioDeLinha(r!);
  }

  private async atualizar(tx: Db, p: Prontuario, ctx: ContextoEscrita): Promise<Prontuario> {
    const r = await tx.one(
      `UPDATE prontuario SET tipo_sanguineo=$2, alergias=$3, comorbidades=$4, medicamentos_uso_continuo=$5, observacoes=$6,
         atualizado_em_cliente=$7, sincronizado_por=$8
       WHERE id=$1 RETURNING *`,
      [p.id, p.tipoSanguineo, p.alergias, p.comorbidades, p.medicamentosUsoContinuo, p.observacoes, p.atualizadoEmCliente,
        ctx.profissionalId],
    );
    return prontuarioDeLinha(r!);
  }
}

function resposta(status: number, corpo: UpsertResponse<Prontuario>): RespostaGravada {
  return { status, corpo };
}
