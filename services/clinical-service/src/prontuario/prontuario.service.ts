import { HttpStatus, Injectable } from '@nestjs/common';
import type { Page, Prontuario, ProntuarioDetalhe, ProntuarioInput, ProntuarioResumo } from '@medicalfield/shared';
import { DatabaseService, type Db } from '../db/database.service';
import { ApiError } from '../common/errors';
import { pessoaDeLinha, prontuarioDeLinha, resumoDeLinha } from '../common/mappers';
import { MergeStrategy } from '../sync/strategies';
import { houveConflito, SyncSupport, type RespostaGravada } from '../sync/sync-support';

const SELECT = `
  SELECT pr.*, row_to_json(pe) AS pessoa_json,
         (SELECT count(*)::int FROM atendimento a WHERE a.prontuario_id = pr.id) AS total_atendimentos
  FROM prontuario pr JOIN pessoa pe ON pe.id = pr.pessoa_id`;

const resumo = (r: Record<string, any>): ProntuarioResumo => ({
  ...prontuarioDeLinha(r),
  pessoa: pessoaDeLinha(r.pessoa_json),
  totalAtendimentos: r.total_atendimentos,
});

@Injectable()
export class ProntuarioService {
  /** Alergias e comorbidades de duas equipes são unidas; o resto vence a edição mais recente. */
  private readonly estrategia = new MergeStrategy<Prontuario>(['alergias', 'comorbidades']);

  constructor(private readonly db: DatabaseService, private readonly sync: SyncSupport) {}

  async listar(busca: string | undefined, pagina: number, tamanho: number): Promise<Page<ProntuarioResumo>> {
    const filtro = busca?.trim() ? `%${busca.trim()}%` : null;
    const where = 'WHERE ($1::text IS NULL OR pe.nome ILIKE $1 OR pe.cpf LIKE $1)';
    const total = await this.db.one(`SELECT count(*)::int n FROM prontuario pr JOIN pessoa pe ON pe.id = pr.pessoa_id ${where}`, [filtro]);
    const linhas = await this.db.query(`${SELECT} ${where} ORDER BY pr.sincronizado_em DESC LIMIT $2 OFFSET $3`, [
      filtro,
      tamanho,
      (pagina - 1) * tamanho,
    ]);
    return { itens: linhas.map(resumo), pagina, tamanho, total: total.n };
  }

  /** Prontuário com os dados da pessoa e os atendimentos dela. */
  async obter(id: string): Promise<ProntuarioDetalhe> {
    const r = await this.db.one(`${SELECT} WHERE pr.id = $1`, [id]);
    if (!r) throw ApiError.naoEncontrado('Prontuário');
    const atendimentos = await this.db.query(
      `SELECT a.*, pe.nome AS pessoa_nome FROM atendimento a JOIN pessoa pe ON pe.id = a.pessoa_id
       WHERE a.prontuario_id = $1 ORDER BY a.data_hora DESC`,
      [id],
    );
    return { ...resumo(r), atendimentos: atendimentos.map(resumoDeLinha) };
  }

  upsert(input: ProntuarioInput, opId: string | null) {
    return this.sync.executar(opId, (tx) => this.gravar(tx, input));
  }

  private async gravar(tx: Db, recebido: ProntuarioInput): Promise<RespostaGravada> {
    if (!(await tx.one('SELECT 1 FROM pessoa WHERE id = $1', [recebido.pessoaId]))) {
      throw ApiError.dependenciaAusente('A pessoa deste prontuário ainda não foi sincronizada.');
    }
    const linha = await tx.one('SELECT * FROM prontuario WHERE id = $1 FOR UPDATE', [recebido.id]);
    if (!linha) {
      const r = await tx.one(
        `INSERT INTO prontuario (id, pessoa_id, tipo_sanguineo, alergias, comorbidades, observacoes,
           atualizado_em_cliente, registrado_por, dispositivo_id, criado_offline)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [recebido.id, recebido.pessoaId, recebido.tipoSanguineo, recebido.alergias, recebido.comorbidades, recebido.observacoes,
          recebido.atualizadoEmCliente, recebido.registradoPor, recebido.dispositivoId, recebido.criadoOffline],
      );
      return { status: HttpStatus.CREATED, corpo: { resultado: 'CRIADO', registro: prontuarioDeLinha(r) } };
    }

    const servidor = prontuarioDeLinha(linha);
    const conflito = houveConflito(servidor.version!, recebido.baseVersion);
    const final = conflito ? this.estrategia.resolve(servidor, recebido) : recebido;
    const r = await tx.one(
      `UPDATE prontuario SET tipo_sanguineo=$2, alergias=$3, comorbidades=$4, observacoes=$5, atualizado_em_cliente=$6,
         sincronizado_em=now() WHERE id=$1 RETURNING *`,
      [final.id, final.tipoSanguineo, final.alergias, final.comorbidades, final.observacoes, final.atualizadoEmCliente],
    );
    const salvo = prontuarioDeLinha(r);
    if (conflito) await this.sync.registrarConflito(tx, 'PRONTUARIO', salvo.id, this.estrategia.nome, servidor, recebido, salvo);
    return { status: HttpStatus.OK, corpo: { resultado: conflito ? 'MESCLADO' : 'ATUALIZADO', registro: salvo } };
  }
}
