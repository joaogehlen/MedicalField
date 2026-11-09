import { HttpStatus, Injectable } from '@nestjs/common';
import {
  alertasImpeditivos,
  avaliarAdministracao,
  type AdministracaoMedicamento,
  type Adendo,
  type Atendimento,
  type AtendimentoDetalhe,
  type AtendimentoInput,
  type AtendimentoResumo,
  type Classificacao,
  type Page,
  type SinalVital,
  type StatusAtendimento,
  type UpsertResponse,
} from '@medicalfield/shared';
import { DatabaseService, type Db } from '../db/database.service';
import { pessoaCanonica, prontuarioCanonico } from '../common/aliases';
import { ApiError } from '../common/errors';
import {
  administracaoDeLinha,
  atendimentoDeLinha,
  hospitalDeLinha,
  medicamentoDeLinha,
  pessoaDeLinha,
  prontuarioDeLinha,
  sinalDeLinha,
  viaturaDeLinha,
} from '../common/mappers';
import type { UsuarioToken } from '../common/request';
import {
  AppendOnlyUnionStrategy,
  LastWriteWinsStrategy,
  ServerWinsStrategy,
  type ConflictResolutionStrategy,
} from '../sync/strategies';
import { houveConflito, SyncSupport, type ContextoEscrita, type RespostaGravada } from '../sync/sync-support';

export interface FiltrosAtendimento {
  de?: string;
  ate?: string;
  classificacao?: Classificacao;
  status?: StatusAtendimento;
  profissionalId?: string;
  pessoaId?: string;
  busca?: string;
}

type Cabecalho = Omit<Atendimento, 'sinaisVitais' | 'medicamentos' | 'adendos'>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOuNull = (v?: string) => (v && UUID_RE.test(v) ? v : null);
const dataOuNull = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? v : null);

/** Campos do cabeçalho comparados para saber se duas versões divergem. */
const camposCabecalho = (a: Cabecalho) =>
  JSON.stringify([
    a.viaturaId, a.hospitalDestinoId, a.status, a.iniciadoEm, a.finalizadoEm, a.local, a.queixaPrincipal,
    a.descricao, a.triagem, a.glasgow, a.procedimentos,
  ]);

@Injectable()
export class AtendimentoService {
  private readonly lww = new LastWriteWinsStrategy<Cabecalho>();
  private readonly finalizadoVence = new ServerWinsStrategy<Cabecalho>();
  private readonly uniaoSinais = new AppendOnlyUnionStrategy<SinalVital>();
  private readonly uniaoMedicamentos = new AppendOnlyUnionStrategy<AdministracaoMedicamento>();

  constructor(private readonly db: DatabaseService, private readonly sync: SyncSupport) {}

  /* ------------------------------- Leitura ---------------------------------- */

  async listar(f: FiltrosAtendimento, pagina: number, tamanho: number, offset: number): Promise<Page<AtendimentoResumo>> {
    const args = [
      dataOuNull(f.de),
      dataOuNull(f.ate),
      f.classificacao ?? null,
      f.status ?? null,
      uuidOuNull(f.profissionalId),
      uuidOuNull(f.pessoaId),
      f.busca?.trim() ? `%${f.busca.trim()}%` : null,
    ];
    const where = `WHERE NOT a.excluido
      AND ($1::timestamptz IS NULL OR a.iniciado_em >= $1) AND ($2::timestamptz IS NULL OR a.iniciado_em <= $2)
      AND ($3::text IS NULL OR a.triagem_classificacao = $3) AND ($4::text IS NULL OR a.status = $4)
      AND ($5::uuid IS NULL OR a.registrado_por = $5) AND ($6::uuid IS NULL OR a.pessoa_id = $6)
      AND ($7::text IS NULL OR pe.nome ILIKE $7 OR a.queixa_principal ILIKE $7 OR a.local_descricao ILIKE $7)`;
    const from = 'FROM atendimento a JOIN pessoa pe ON pe.id = a.pessoa_id LEFT JOIN hospital h ON h.id = a.hospital_destino_id';
    const total = await this.db.one<{ n: number }>(`SELECT count(*)::int n ${from} ${where}`, args);
    const linhas = await this.db.query(
      `SELECT a.*, pe.nome AS pessoa_nome, h.nome AS hospital_nome ${from} ${where}
       ORDER BY a.iniciado_em DESC LIMIT $8 OFFSET $9`,
      [...args, tamanho, offset],
    );
    return { itens: linhas.map(resumoDeLinha), pagina, tamanho, total: total?.n ?? 0 };
  }

  /** Todos os atendimentos de uma pessoa (rota da proposta: GET /atendimento/{id}). */
  async porPessoa(pessoaId: string): Promise<AtendimentoResumo[]> {
    const canonica = (await pessoaCanonica(this.db, pessoaId)) ?? pessoaId;
    const linhas = await this.db.query(
      `SELECT a.*, pe.nome AS pessoa_nome, h.nome AS hospital_nome
       FROM atendimento a JOIN pessoa pe ON pe.id = a.pessoa_id LEFT JOIN hospital h ON h.id = a.hospital_destino_id
       WHERE a.pessoa_id = $1 AND NOT a.excluido ORDER BY a.iniciado_em DESC`,
      [canonica],
    );
    return linhas.map(resumoDeLinha);
  }

  async detalhe(id: string): Promise<AtendimentoDetalhe> {
    const [atendimento] = await carregarCompletos(this.db, [id]);
    if (!atendimento) throw ApiError.naoEncontrado('Atendimento');
    const [pessoa, prontuario, hospital, viatura, catalogo] = await Promise.all([
      this.db.one('SELECT * FROM pessoa WHERE id = $1', [atendimento.pessoaId]),
      this.db.one('SELECT * FROM prontuario WHERE id = $1', [atendimento.prontuarioId]),
      atendimento.hospitalDestinoId ? this.db.one('SELECT * FROM hospital WHERE id = $1', [atendimento.hospitalDestinoId]) : null,
      atendimento.viaturaId ? this.db.one('SELECT * FROM viatura WHERE id = $1', [atendimento.viaturaId]) : null,
      this.db.query('SELECT * FROM medicamento WHERE id = ANY($1::uuid[])', [atendimento.medicamentos.map((m) => m.medicamentoId)]),
    ]);
    return {
      ...atendimento,
      pessoa: pessoaDeLinha(pessoa!),
      prontuario: prontuarioDeLinha(prontuario!),
      hospitalDestino: hospital ? hospitalDeLinha(hospital) : null,
      viatura: viatura ? viaturaDeLinha(viatura) : null,
      medicamentosCatalogo: catalogo.map(medicamentoDeLinha),
    };
  }

  /* ------------------------------- Escrita ---------------------------------- */

  upsert(input: AtendimentoInput, ctx: ContextoEscrita, usuario: UsuarioToken) {
    return this.sync.executar(ctx, 'ATENDIMENTO', input.id, (tx) => this.gravar(tx, input, ctx, usuario));
  }

  private async gravar(tx: Db, input: AtendimentoInput, ctx: ContextoEscrita, usuario: UsuarioToken): Promise<RespostaGravada> {
    const pessoaId = await pessoaCanonica(tx, input.pessoaId);
    const prontuarioId = await prontuarioCanonico(tx, input.prontuarioId);
    if (!pessoaId || !prontuarioId) {
      throw ApiError.dependenciaAusente('A pessoa ou o prontuário deste atendimento ainda não foram sincronizados.');
    }
    const prontuario = await tx.one('SELECT * FROM prontuario WHERE id = $1', [prontuarioId]);
    if (prontuario!.pessoa_id !== pessoaId) {
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDACAO', 'Dados inválidos', 'O prontuário informado pertence a outra pessoa.');
    }
    const recebido: Atendimento = { ...input, pessoaId, prontuarioId };

    const linha = await tx.one('SELECT * FROM atendimento WHERE id = $1 FOR UPDATE', [input.id]);
    const existente = linha ? (await carregarCompletos(tx, [input.id]))[0] : null;

    await this.revalidarSeguranca(tx, recebido, existente, prontuario!.alergias ?? [], usuario);

    if (!existente) {
      await this.inserirCabecalho(tx, recebido, ctx);
      await this.gravarItens(tx, recebido.id, recebido.sinaisVitais, recebido.medicamentos, true);
      return resposta(HttpStatus.CREATED, { resultado: 'CRIADO', registro: await this.recarregar(tx, recebido.id) });
    }

    const conflito = houveConflito(existente.version!, input.baseVersion);
    if (!conflito && existente.status !== 'FINALIZADO') {
      await this.atualizarCabecalho(tx, recebido, ctx);
      await this.gravarItens(tx, recebido.id, recebido.sinaisVitais, recebido.medicamentos, true);
      return resposta(HttpStatus.OK, { resultado: 'ATUALIZADO', registro: await this.recarregar(tx, recebido.id) });
    }

    // Atendimento finalizado é imutável (correções via adendo); senão vence a edição mais recente.
    const estrategia: ConflictResolutionStrategy<Cabecalho> = existente.status === 'FINALIZADO' ? this.finalizadoVence : this.lww;
    const cabecalho = estrategia.resolve(existente, recebido);
    const divergente = camposCabecalho(existente) !== camposCabecalho(recebido);
    await this.atualizarCabecalho(tx, { ...cabecalho, sinaisVitais: [], medicamentos: [] } as Atendimento, ctx);
    const sinais = this.uniaoSinais.resolve(existente.sinaisVitais, recebido.sinaisVitais);
    const medicamentos = this.uniaoMedicamentos.resolve(existente.medicamentos, recebido.medicamentos);
    await this.gravarItens(tx, recebido.id, sinais, medicamentos, false);
    const salvo = await this.recarregar(tx, recebido.id);

    if (!conflito && !divergente) {
      return resposta(HttpStatus.OK, { resultado: 'ATUALIZADO', registro: salvo });
    }
    await this.sync.registrarConflito(tx, ctx, {
      entidade: 'ATENDIMENTO', entidadeId: recebido.id, estrategia: estrategia.nome, versaoServidor: existente.version!,
      versaoBaseCliente: input.baseVersion, valorServidor: existente, valorRecebido: recebido, valorResultante: salvo,
    });
    return resposta(HttpStatus.OK, { resultado: 'MESCLADO', registro: salvo });
  }

  async adicionarAdendo(atendimentoId: string, adendo: { id: string; texto: string }, usuario: UsuarioToken): Promise<Adendo> {
    return this.db.transaction(async (tx) => {
      const existe = await tx.one('SELECT id FROM atendimento WHERE id = $1 FOR UPDATE', [atendimentoId]);
      if (!existe) throw ApiError.naoEncontrado('Atendimento');
      const r = await tx.one(
        `INSERT INTO adendo (id, atendimento_id, texto, autor_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id RETURNING *`,
        [adendo.id, atendimentoId, adendo.texto, usuario.id],
      );
      // Toca o atendimento para que o adendo chegue aos dispositivos no próximo pull.
      await tx.query('UPDATE atendimento SET sincronizado_em = now() WHERE id = $1', [atendimentoId]);
      return { id: r!.id, texto: r!.texto, autorId: r!.autor_id, criadoEm: new Date(r!.criado_em).toISOString() };
    });
  }

  /**
   * Revalida no servidor as regras de segurança clínica (mesma ClinicalSafetyChain do
   * cliente) para as administrações ainda não registradas.
   */
  private async revalidarSeguranca(
    tx: Db,
    recebido: Atendimento,
    existente: Atendimento | null,
    alergias: string[],
    usuario: UsuarioToken,
  ) {
    const jaRegistradas = new Set(existente?.medicamentos.map((m) => m.id) ?? []);
    const novas = recebido.medicamentos.filter((m) => !jaRegistradas.has(m.id));
    if (novas.length === 0) return;
    const todas = this.uniaoMedicamentos.resolve(existente?.medicamentos ?? [], recebido.medicamentos);
    const catalogo = new Map(
      (await tx.query('SELECT * FROM medicamento WHERE id = ANY($1::uuid[])', [novas.map((m) => m.medicamentoId)])).map((r) => [
        r.id as string,
        medicamentoDeLinha(r),
      ]),
    );
    for (const adm of novas) {
      const medicamento = catalogo.get(adm.medicamentoId);
      if (!medicamento) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDACAO', 'Dados inválidos', 'Medicamento não existe no catálogo.');
      }
      const alertas = avaliarAdministracao({
        medicamento,
        dose: adm.dose,
        via: adm.via,
        administradoEm: adm.administradoEm,
        alergias,
        administracoesAnteriores: todas.filter((m) => m.id !== adm.id),
        papel: adm.administradoPor === usuario.id ? usuario.papel : undefined,
      });
      const impeditivos = alertasImpeditivos(alertas, adm.alertasIgnorados);
      if (impeditivos.length > 0) {
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'REGRA_CLINICA', 'Regra de segurança clínica', impeditivos[0].mensagem, {
          alertas: impeditivos,
          administracaoId: adm.id,
        });
      }
    }
  }

  private recarregar(tx: Db, id: string) {
    return carregarCompletos(tx, [id]).then((r) => r[0]);
  }

  private async inserirCabecalho(tx: Db, a: Atendimento, ctx: ContextoEscrita) {
    await tx.query(
      `INSERT INTO atendimento (id, pessoa_id, prontuario_id, viatura_id, hospital_destino_id, status, iniciado_em, finalizado_em,
         local_descricao, latitude, longitude, queixa_principal, descricao, triagem_protocolo, triagem_classificacao,
         glasgow_ocular, glasgow_verbal, glasgow_motora, glasgow_total, procedimentos, atualizado_em_cliente,
         registrado_por, sincronizado_por, sincronizado_em, dispositivo_id, criado_offline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now(),$24,$25)`,
      [a.id, a.pessoaId, a.prontuarioId, a.viaturaId, a.hospitalDestinoId, a.status, a.iniciadoEm, a.finalizadoEm,
        a.local.descricao, a.local.latitude, a.local.longitude, a.queixaPrincipal, a.descricao, a.triagem.protocolo,
        a.triagem.classificacao, a.glasgow.ocular, a.glasgow.verbal, a.glasgow.motora, a.glasgow.total, a.procedimentos,
        a.atualizadoEmCliente, a.registradoPor, ctx.profissionalId, a.dispositivoId, a.criadoOffline ?? false],
    );
  }

  private async atualizarCabecalho(tx: Db, a: Atendimento, ctx: ContextoEscrita) {
    await tx.query(
      `UPDATE atendimento SET viatura_id=$2, hospital_destino_id=$3, status=$4, iniciado_em=$5, finalizado_em=$6,
         local_descricao=$7, latitude=$8, longitude=$9, queixa_principal=$10, descricao=$11, triagem_protocolo=$12,
         triagem_classificacao=$13, glasgow_ocular=$14, glasgow_verbal=$15, glasgow_motora=$16, glasgow_total=$17,
         procedimentos=$18, atualizado_em_cliente=$19, sincronizado_por=$20, sincronizado_em=now()
       WHERE id=$1`,
      [a.id, a.viaturaId, a.hospitalDestinoId, a.status, a.iniciadoEm, a.finalizadoEm, a.local.descricao, a.local.latitude,
        a.local.longitude, a.queixaPrincipal, a.descricao, a.triagem.protocolo, a.triagem.classificacao, a.glasgow.ocular,
        a.glasgow.verbal, a.glasgow.motora, a.glasgow.total, a.procedimentos, a.atualizadoEmCliente, ctx.profissionalId],
    );
  }

  /** Grava sinais e medicamentos; `sobrescrever` = o dispositivo é dono da versão (sem conflito). */
  private async gravarItens(
    tx: Db,
    atendimentoId: string,
    sinais: SinalVital[],
    medicamentos: AdministracaoMedicamento[],
    sobrescrever: boolean,
  ) {
    for (const s of sinais) {
      await tx.query(
        `INSERT INTO sinal_vital (id, atendimento_id, aferido_em, pa_sistolica, pa_diastolica, fc, fr, spo2, temperatura, glicemia, dor)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO ${sobrescrever
           ? `UPDATE SET aferido_em=EXCLUDED.aferido_em, pa_sistolica=EXCLUDED.pa_sistolica, pa_diastolica=EXCLUDED.pa_diastolica,
              fc=EXCLUDED.fc, fr=EXCLUDED.fr, spo2=EXCLUDED.spo2, temperatura=EXCLUDED.temperatura, glicemia=EXCLUDED.glicemia,
              dor=EXCLUDED.dor WHERE sinal_vital.atendimento_id = EXCLUDED.atendimento_id`
           : 'NOTHING'}`,
        [s.id, atendimentoId, s.aferidoEm, s.paSistolica, s.paDiastolica, s.fc, s.fr, s.spo2, s.temperatura, s.glicemia, s.dor],
      );
    }
    for (const m of medicamentos) {
      await tx.query(
        `INSERT INTO administracao_medicamento (id, atendimento_id, medicamento_id, dose, unidade, via, administrado_em,
           administrado_por, observacao, alertas_ignorados)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO ${sobrescrever
           ? `UPDATE SET observacao=EXCLUDED.observacao WHERE administracao_medicamento.atendimento_id = EXCLUDED.atendimento_id`
           : 'NOTHING'}`,
        [m.id, atendimentoId, m.medicamentoId, m.dose, m.unidade, m.via, m.administradoEm, m.administradoPor, m.observacao,
          JSON.stringify(m.alertasIgnorados ?? [])],
      );
    }
  }
}

/** Carrega atendimentos completos (cabeçalho + sinais + medicamentos + adendos). */
export async function carregarCompletos(db: Db, ids: string[]): Promise<Atendimento[]> {
  if (ids.length === 0) return [];
  const [cabecalhos, sinais, medicamentos, adendos] = await Promise.all([
    db.query('SELECT * FROM atendimento WHERE id = ANY($1::uuid[])', [ids]),
    db.query('SELECT * FROM sinal_vital WHERE atendimento_id = ANY($1::uuid[]) ORDER BY aferido_em', [ids]),
    db.query('SELECT * FROM administracao_medicamento WHERE atendimento_id = ANY($1::uuid[]) ORDER BY administrado_em', [ids]),
    db.query('SELECT * FROM adendo WHERE atendimento_id = ANY($1::uuid[]) ORDER BY criado_em', [ids]),
  ]);
  const porId = new Map(cabecalhos.map((c) => [c.id as string, { ...atendimentoDeLinha(c), adendos: [] as Adendo[] }]));
  for (const s of sinais) porId.get(s.atendimento_id)?.sinaisVitais.push(sinalDeLinha(s));
  for (const m of medicamentos) porId.get(m.atendimento_id)?.medicamentos.push(administracaoDeLinha(m));
  for (const d of adendos) {
    porId.get(d.atendimento_id)?.adendos.push({
      id: d.id, texto: d.texto, autorId: d.autor_id, criadoEm: new Date(d.criado_em).toISOString(),
    });
  }
  return ids.map((id) => porId.get(id)).filter((a): a is Atendimento & { adendos: Adendo[] } => !!a);
}

function resumoDeLinha(r: Record<string, any>): AtendimentoResumo {
  const a = atendimentoDeLinha(r);
  return {
    id: a.id,
    pessoaId: a.pessoaId,
    pessoaNome: r.pessoa_nome,
    prontuarioId: a.prontuarioId,
    status: a.status,
    iniciadoEm: a.iniciadoEm,
    queixaPrincipal: a.queixaPrincipal,
    triagem: a.triagem,
    glasgowTotal: a.glasgow.total,
    localDescricao: a.local.descricao,
    registradoPor: a.registradoPor,
    criadoOffline: !!a.criadoOffline,
    sincronizadoEm: a.sincronizadoEm,
    hospitalDestinoNome: r.hospital_nome ?? null,
  };
}

function resposta(status: number, corpo: UpsertResponse<Atendimento>): RespostaGravada {
  return { status, corpo };
}
