/** Conversão entre linhas do banco (snake_case) e o domínio compartilhado. */
import type { Atendimento, AtendimentoResumo, Medicamento, Pessoa, Prontuario } from '@medicalfield/shared';

type Linha = Record<string, any>;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

const meta = (r: Linha) => ({
  version: r.version,
  changeSeq: r.change_seq,
  atualizadoEmCliente: iso(r.atualizado_em_cliente)!,
  registradoPor: r.registrado_por,
  dispositivoId: r.dispositivo_id,
  criadoOffline: r.criado_offline,
  sincronizadoEm: iso(r.sincronizado_em),
});

export const pessoaDeLinha = (r: Linha): Pessoa => ({
  id: r.id,
  nome: r.nome,
  cpf: r.cpf,
  dataNascimento: r.data_nascimento,
  sexo: r.sexo,
  telefone: r.telefone,
  email: r.email,
  contatoNome: r.contato_nome,
  contatoEmail: r.contato_email,
  ...meta(r),
});

export const prontuarioDeLinha = (r: Linha): Prontuario => ({
  id: r.id,
  pessoaId: r.pessoa_id,
  tipoSanguineo: r.tipo_sanguineo,
  alergias: r.alergias ?? [],
  comorbidades: r.comorbidades ?? [],
  observacoes: r.observacoes,
  ...meta(r),
});

/** Atendimento sem a lista de medicamentos (preenchida à parte). */
export const atendimentoDeLinha = (r: Linha): Atendimento => ({
  id: r.id,
  pessoaId: r.pessoa_id,
  prontuarioId: r.prontuario_id,
  dataHora: iso(r.data_hora)!,
  local: r.local,
  queixaPrincipal: r.queixa_principal,
  observacoes: r.observacoes,
  triagem: { protocolo: r.triagem_protocolo, classificacao: r.triagem_classificacao },
  glasgow: { ocular: r.glasgow_ocular, verbal: r.glasgow_verbal, motora: r.glasgow_motora, total: r.glasgow_total },
  sinaisVitais: {
    paSistolica: r.pa_sistolica,
    paDiastolica: r.pa_diastolica,
    fc: r.fc,
    fr: r.fr,
    spo2: r.spo2,
    temperatura: r.temperatura,
    glicemia: r.glicemia,
  },
  medicamentos: [],
  profissionalNome: r.profissional_nome,
  ...meta(r),
});

export const resumoDeLinha = (r: Linha): AtendimentoResumo => ({
  id: r.id,
  pessoaId: r.pessoa_id,
  pessoaNome: r.pessoa_nome,
  dataHora: iso(r.data_hora)!,
  queixaPrincipal: r.queixa_principal,
  local: r.local,
  triagem: { protocolo: r.triagem_protocolo, classificacao: r.triagem_classificacao },
  profissionalNome: r.profissional_nome,
  criadoOffline: r.criado_offline,
  sincronizadoEm: iso(r.sincronizado_em),
});

export const medicamentoDeLinha = (r: Linha): Medicamento => ({
  id: r.id,
  nome: r.nome,
  apresentacao: r.apresentacao,
  unidade: r.unidade,
  viasPermitidas: r.vias_permitidas ?? [],
  doseMaxima: r.dose_maxima,
  alergenos: r.alergenos ?? [],
  ativo: r.ativo,
  changeSeq: r.change_seq,
});
