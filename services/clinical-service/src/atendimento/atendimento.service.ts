import { HttpStatus, Injectable } from '@nestjs/common';
import {
  avaliarAdministracao,
  type Atendimento,
  type AtendimentoDetalhe,
  type AtendimentoInput,
  type AtendimentoResumo,
  type Page,
} from '@medicalfield/shared';
import { DatabaseService, type Db } from '../db/database.service';
import { ApiError } from '../common/errors';
import { atendimentoDeLinha, medicamentoDeLinha, pessoaDeLinha, prontuarioDeLinha, resumoDeLinha } from '../common/mappers';
import { ServerWinsStrategy } from '../sync/strategies';
import { SyncSupport, type RespostaGravada } from '../sync/sync-support';

const SELECT_RESUMO = 'SELECT a.*, pe.nome AS pessoa_nome FROM atendimento a JOIN pessoa pe ON pe.id = a.pessoa_id';

/** Atendimentos completos (com os medicamentos administrados). */
export async function carregarAtendimentos(db: Db, ids: string[]): Promise<Atendimento[]> {
  if (ids.length === 0) return [];
  const [linhas, meds] = await Promise.all([
    db.query('SELECT * FROM atendimento WHERE id = ANY($1::uuid[])', [ids]),
    db.query('SELECT * FROM medicamento_administrado WHERE atendimento_id = ANY($1::uuid[]) ORDER BY horario', [ids]),
  ]);
  const porId = new Map(linhas.map((l) => [l.id as string, atendimentoDeLinha(l)]));
  for (const m of meds) {
    porId.get(m.atendimento_id)?.medicamentos.push({
      id: m.id,
      medicamentoId: m.medicamento_id,
      dose: m.dose,
      via: m.via,
      horario: new Date(m.horario).toISOString(),
    });
  }
  return ids.map((id) => porId.get(id)).filter((a): a is Atendimento => !!a);
}

@Injectable()
export class AtendimentoService {
  /** Atendimento registrado é imutável: num conflito, o registro do servidor prevalece. */
  private readonly estrategia = new ServerWinsStrategy<Atendimento>();

  constructor(private readonly db: DatabaseService, private readonly sync: SyncSupport) {}

  async listar(busca: string | undefined, pagina: number, tamanho: number): Promise<Page<AtendimentoResumo>> {
    const filtro = busca?.trim() ? `%${busca.trim()}%` : null;
    const where = 'WHERE ($1::text IS NULL OR pe.nome ILIKE $1 OR a.queixa_principal ILIKE $1 OR a.local ILIKE $1)';
    const total = await this.db.one(`SELECT count(*)::int n FROM atendimento a JOIN pessoa pe ON pe.id = a.pessoa_id ${where}`, [filtro]);
    const linhas = await this.db.query(`${SELECT_RESUMO} ${where} ORDER BY a.data_hora DESC LIMIT $2 OFFSET $3`, [
      filtro,
      tamanho,
      (pagina - 1) * tamanho,
    ]);
    return { itens: linhas.map(resumoDeLinha), pagina, tamanho, total: total.n };
  }

  /** Todos os atendimentos de uma pessoa (rota da proposta: GET /atendimento/{id}). */
  async daPessoa(pessoaId: string): Promise<AtendimentoResumo[]> {
    return (await this.db.query(`${SELECT_RESUMO} WHERE a.pessoa_id = $1 ORDER BY a.data_hora DESC`, [pessoaId])).map(resumoDeLinha);
  }

  async detalhe(id: string): Promise<AtendimentoDetalhe> {
    const [a] = await carregarAtendimentos(this.db, [id]);
    if (!a) throw ApiError.naoEncontrado('Atendimento');
    const [pessoa, prontuario, catalogo] = await Promise.all([
      this.db.one('SELECT * FROM pessoa WHERE id = $1', [a.pessoaId]),
      this.db.one('SELECT * FROM prontuario WHERE id = $1', [a.prontuarioId]),
      this.db.query('SELECT * FROM medicamento WHERE id = ANY($1::uuid[])', [a.medicamentos.map((m) => m.medicamentoId)]),
    ]);
    return { ...a, pessoa: pessoaDeLinha(pessoa), prontuario: prontuarioDeLinha(prontuario), medicamentosCatalogo: catalogo.map(medicamentoDeLinha) };
  }

  upsert(input: AtendimentoInput, opId: string | null) {
    return this.sync.executar(opId, (tx) => this.gravar(tx, input));
  }

  private async gravar(tx: Db, a: AtendimentoInput): Promise<RespostaGravada> {
    const prontuario = await tx.one('SELECT * FROM prontuario WHERE id = $1', [a.prontuarioId]);
    if (!prontuario) throw ApiError.dependenciaAusente('O prontuário deste atendimento ainda não foi sincronizado.');
    if (prontuario.pessoa_id !== a.pessoaId) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDACAO', 'Dados inválidos', 'O prontuário pertence a outra pessoa.');
    }

    const existente = (await carregarAtendimentos(tx, [a.id]))[0];
    if (existente) {
      // Reenvio ou edição concorrente de um atendimento já registrado: o servidor prevalece.
      const final = this.estrategia.resolve(existente);
      const igual = existente.atualizadoEmCliente === a.atualizadoEmCliente;
      if (!igual) await this.sync.registrarConflito(tx, 'ATENDIMENTO', a.id, this.estrategia.nome, existente, a, final);
      return { status: HttpStatus.OK, corpo: { resultado: igual ? 'ATUALIZADO' : 'MESCLADO', registro: final } };
    }

    await this.revalidarSeguranca(tx, a, prontuario.alergias ?? []);
    const s = a.sinaisVitais;
    await tx.query(
      `INSERT INTO atendimento (id, pessoa_id, prontuario_id, data_hora, local, queixa_principal, observacoes,
         triagem_protocolo, triagem_classificacao, glasgow_ocular, glasgow_verbal, glasgow_motora, glasgow_total,
         pa_sistolica, pa_diastolica, fc, fr, spo2, temperatura, glicemia, profissional_nome,
         atualizado_em_cliente, registrado_por, dispositivo_id, criado_offline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [a.id, a.pessoaId, a.prontuarioId, a.dataHora, a.local, a.queixaPrincipal, a.observacoes, a.triagem.protocolo,
        a.triagem.classificacao, a.glasgow.ocular, a.glasgow.verbal, a.glasgow.motora, a.glasgow.total, s.paSistolica,
        s.paDiastolica, s.fc, s.fr, s.spo2, s.temperatura, s.glicemia, a.profissionalNome, a.atualizadoEmCliente,
        a.registradoPor, a.dispositivoId, a.criadoOffline],
    );
    for (const m of a.medicamentos) {
      await tx.query(
        'INSERT INTO medicamento_administrado (id, atendimento_id, medicamento_id, dose, via, horario) VALUES ($1,$2,$3,$4,$5,$6)',
        [m.id, a.id, m.medicamentoId, m.dose, m.via, m.horario],
      );
    }
    const [salvo] = await carregarAtendimentos(tx, [a.id]);
    return { status: HttpStatus.CREATED, corpo: { resultado: 'CRIADO', registro: salvo } };
  }

  /** As mesmas regras de segurança clínica do aparelho, conferidas de novo no servidor. */
  private async revalidarSeguranca(tx: Db, a: AtendimentoInput, alergias: string[]) {
    if (a.medicamentos.length === 0) return;
    const catalogo = new Map(
      (await tx.query('SELECT * FROM medicamento WHERE id = ANY($1::uuid[])', [a.medicamentos.map((m) => m.medicamentoId)])).map(
        (r) => [r.id as string, medicamentoDeLinha(r)],
      ),
    );
    for (const m of a.medicamentos) {
      const medicamento = catalogo.get(m.medicamentoId);
      if (!medicamento) throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDACAO', 'Dados inválidos', 'Medicamento não existe no catálogo.');
      const alertas = avaliarAdministracao({ medicamento, dose: m.dose, via: m.via, alergias });
      if (alertas.length) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'REGRA_CLINICA', 'Regra de segurança clínica', alertas[0], { alertas });
      }
    }
  }
}
