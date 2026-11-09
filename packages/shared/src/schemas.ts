/**
 * Schemas de validação (zod). Usados pelo clinical-service para validar o corpo das
 * requisições e pelo cliente para validar formulários antes de gravar localmente.
 */
import { z } from 'zod';
import {
  ACOES_LOG,
} from './api';
import {
  CLASSIFICACOES,
  PROTOCOLOS,
  SEXOS,
  STATUS_ATENDIMENTO,
  TIPOS_SANGUINEOS,
  VIAS,
} from './domain';
import { classificacaoValida, FAIXAS_VITAIS, type CampoVital } from './clinical/scales';
import { cpfValido } from './text';

const dataHora = z.string().datetime({ offset: true, message: 'data/hora ISO-8601 inválida' });
const uuid = z.string().uuid('identificador inválido');
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const listaTermos = z.array(z.string().trim().min(1).max(120)).max(50).default([]);

const syncMeta = {
  baseVersion: z.number().int().positive().nullish(),
  atualizadoEmCliente: dataHora,
  registradoPor: uuid,
  dispositivoId: z.string().trim().min(1).max(64),
  criadoOffline: z.boolean().optional().default(false),
};

export const pessoaSchema = z
  .object({
    id: uuid,
    nome: z.string().trim().min(2, 'informe o nome (ou "Desconhecido")').max(160),
    identificada: z.boolean(),
    cpf: textoOpcional(14).refine((v) => !v || cpfValido(v), 'CPF inválido'),
    dataNascimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD')
      .nullish()
      .transform((v) => v ?? null),
    sexo: z.enum(SEXOS).nullish().transform((v) => v ?? null),
    telefone: textoOpcional(30),
    email: z.string().trim().email('e-mail inválido').max(160).nullish().or(z.literal('')).transform((v) => v || null),
    contatoNome: textoOpcional(160),
    contatoParentesco: textoOpcional(60),
    contatoTelefone: textoOpcional(30),
    contatoEmail: z
      .string()
      .trim()
      .email('e-mail do contato inválido')
      .max(160)
      .nullish()
      .or(z.literal(''))
      .transform((v) => v || null),
    caracteristicas: textoOpcional(1000),
    ...syncMeta,
  })
  .refine((p) => p.identificada || !!p.caracteristicas, {
    message: 'descreva as características da vítima não identificada',
    path: ['caracteristicas'],
  });
export type PessoaInput = z.infer<typeof pessoaSchema>;

export const prontuarioSchema = z.object({
  id: uuid,
  pessoaId: uuid,
  tipoSanguineo: z.enum(TIPOS_SANGUINEOS).nullish().transform((v) => v ?? null),
  alergias: listaTermos,
  comorbidades: listaTermos,
  medicamentosUsoContinuo: listaTermos,
  observacoes: textoOpcional(2000),
  ...syncMeta,
});
export type ProntuarioInput = z.infer<typeof prontuarioSchema>;

const vital = (campo: CampoVital) => {
  const f = FAIXAS_VITAIS[campo];
  return z
    .number()
    .min(f.min, `${f.rotulo}: mínimo ${f.min}`)
    .max(f.max, `${f.rotulo}: máximo ${f.max}`)
    .nullish()
    .transform((v) => v ?? null);
};

export const sinalVitalSchema = z
  .object({
    id: uuid,
    aferidoEm: dataHora,
    paSistolica: vital('paSistolica'),
    paDiastolica: vital('paDiastolica'),
    fc: vital('fc'),
    fr: vital('fr'),
    spo2: vital('spo2'),
    temperatura: vital('temperatura'),
    glicemia: vital('glicemia'),
    dor: vital('dor'),
  })
  .refine(
    (s) =>
      [s.paSistolica, s.paDiastolica, s.fc, s.fr, s.spo2, s.temperatura, s.glicemia, s.dor].some((v) => v !== null),
    { message: 'registre ao menos um sinal vital' },
  )
  .refine((s) => s.paSistolica === null || s.paDiastolica === null || s.paSistolica > s.paDiastolica, {
    message: 'PA sistólica deve ser maior que a diastólica',
    path: ['paSistolica'],
  });

export const administracaoSchema = z.object({
  id: uuid,
  medicamentoId: uuid,
  dose: z.number().positive('dose deve ser maior que zero').max(100_000),
  unidade: z.string().trim().min(1).max(20),
  via: z.enum(VIAS),
  administradoEm: dataHora,
  administradoPor: uuid,
  observacao: textoOpcional(500),
  alertasIgnorados: z
    .array(z.object({ codigo: z.string().min(1).max(40), justificativa: z.string().trim().min(5).max(500) }))
    .max(10)
    .default([]),
});

export const glasgowSchema = z
  .object({
    ocular: z.number().int().min(1).max(4),
    verbal: z.number().int().min(1).max(5),
    motora: z.number().int().min(1).max(6),
    total: z.number().int().min(3).max(15),
  })
  .refine((g) => g.total === g.ocular + g.verbal + g.motora, {
    message: 'total da Escala de Glasgow deve ser a soma ocular + verbal + motora',
    path: ['total'],
  });

export const triagemSchema = z
  .object({ protocolo: z.enum(PROTOCOLOS), classificacao: z.enum(CLASSIFICACOES) })
  .refine((t) => classificacaoValida(t.protocolo, t.classificacao), {
    message: 'classificação não existe no protocolo escolhido',
    path: ['classificacao'],
  });

export const atendimentoSchema = z
  .object({
    id: uuid,
    pessoaId: uuid,
    prontuarioId: uuid,
    viaturaId: uuid.nullish().transform((v) => v ?? null),
    hospitalDestinoId: uuid.nullish().transform((v) => v ?? null),
    status: z.enum(STATUS_ATENDIMENTO),
    iniciadoEm: dataHora,
    finalizadoEm: dataHora.nullish().transform((v) => v ?? null),
    local: z.object({
      descricao: z.string().trim().min(2, 'informe o local da ocorrência').max(300),
      latitude: z.number().min(-90).max(90).nullish().transform((v) => v ?? null),
      longitude: z.number().min(-180).max(180).nullish().transform((v) => v ?? null),
    }),
    queixaPrincipal: z.string().trim().min(2, 'informe a queixa principal').max(300),
    descricao: textoOpcional(4000),
    triagem: triagemSchema,
    glasgow: glasgowSchema,
    sinaisVitais: z.array(sinalVitalSchema).max(100).default([]),
    medicamentos: z.array(administracaoSchema).max(100).default([]),
    procedimentos: listaTermos,
    ...syncMeta,
  })
  .refine((a) => a.status !== 'FINALIZADO' || !!a.finalizadoEm, {
    message: 'atendimento finalizado precisa da hora de finalização',
    path: ['finalizadoEm'],
  })
  .refine((a) => !a.finalizadoEm || Date.parse(a.finalizadoEm) >= Date.parse(a.iniciadoEm), {
    message: 'finalização não pode ser anterior ao início',
    path: ['finalizadoEm'],
  });
export type AtendimentoInput = z.infer<typeof atendimentoSchema>;

export const adendoSchema = z.object({
  id: uuid,
  texto: z.string().trim().min(5).max(2000),
});

export const logBatchSchema = z.object({
  dispositivoId: z.string().trim().min(1).max(64),
  logs: z
    .array(
      z.object({
        id: uuid,
        dataHora,
        nivel: z.enum(['INFO', 'WARN', 'ERROR']),
        profissionalId: uuid.nullish(),
        acao: z.enum(ACOES_LOG),
        entidade: z.string().max(40).nullish(),
        entidadeId: z.string().max(64).nullish(),
        detalhes: z.record(z.unknown()).nullish(),
      }),
    )
    .min(1)
    .max(500),
});

export const loginSchema = z.object({
  tipoRegistro: z.enum(['CRM', 'COREN', 'SOCORRISTA']),
  numeroRegistro: z.string().trim().min(1, 'informe o número do registro').max(20),
  uf: z.string().trim().length(2, 'UF com 2 letras').toUpperCase().nullish(),
  senha: z.string().min(1, 'informe a senha').max(200),
});

/** Converte erros do zod para a lista `campos` do Problem Details. */
export function camposDoErro(err: z.ZodError): { campo: string; mensagem: string }[] {
  return err.issues.map((i) => ({ campo: i.path.join('.') || '(corpo)', mensagem: i.message }));
}
