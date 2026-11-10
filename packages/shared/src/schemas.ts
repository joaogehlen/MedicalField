/**
 * Validações (zod) usadas pelo clinical-service no corpo das requisições e pelo
 * cliente antes de gravar no aparelho.
 */
import { z } from 'zod';
import { CLASSIFICACOES, PROTOCOLOS, SEXOS, TIPOS_SANGUINEOS, VIAS } from './domain';
import { CAMPOS_VITAIS, classificacaoValida } from './clinical/scales';
import { cpfValido } from './text';

const dataHora = z.string().datetime({ offset: true, message: 'data/hora inválida' });
const uuid = z.string().uuid('identificador inválido');
const texto = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => v || null);
const email = (msg: string) =>
  z.string().trim().email(msg).max(160).nullish().or(z.literal('')).transform((v) => v || null);
const termos = z.array(z.string().trim().min(1).max(120)).max(50).default([]);

const meta = {
  baseVersion: z.number().int().positive().nullish(),
  atualizadoEmCliente: dataHora,
  registradoPor: uuid,
  dispositivoId: z.string().trim().min(1).max(64),
  criadoOffline: z.boolean().optional().default(false),
};

export const pessoaSchema = z.object({
  id: uuid,
  nome: z.string().trim().min(2, 'informe o nome').max(160),
  cpf: texto(14).refine((v) => !v || cpfValido(v), 'CPF inválido'),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida').nullish().or(z.literal('')).transform((v) => v || null),
  sexo: z.enum(SEXOS).nullish().transform((v) => v ?? null),
  telefone: texto(30),
  email: email('e-mail inválido'),
  contatoNome: texto(160),
  contatoEmail: email('e-mail do contato inválido'),
  ...meta,
});
export type PessoaInput = z.infer<typeof pessoaSchema>;

export const prontuarioSchema = z.object({
  id: uuid,
  pessoaId: uuid,
  tipoSanguineo: z.enum(TIPOS_SANGUINEOS).nullish().transform((v) => v ?? null),
  alergias: termos,
  comorbidades: termos,
  observacoes: texto(2000),
  ...meta,
});
export type ProntuarioInput = z.infer<typeof prontuarioSchema>;

const vital = (campo: (typeof CAMPOS_VITAIS)[number]['campo']) => {
  const c = CAMPOS_VITAIS.find((x) => x.campo === campo)!;
  return z.number().min(c.min, `${c.rotulo}: mínimo ${c.min}`).max(c.max, `${c.rotulo}: máximo ${c.max}`).nullish().transform((v) => v ?? null);
};

const sinaisVitaisSchema = z.object({
  paSistolica: vital('paSistolica'),
  paDiastolica: vital('paDiastolica'),
  fc: vital('fc'),
  fr: vital('fr'),
  spo2: vital('spo2'),
  temperatura: vital('temperatura'),
  glicemia: vital('glicemia'),
});

export const atendimentoSchema = z.object({
  id: uuid,
  pessoaId: uuid,
  prontuarioId: uuid,
  dataHora,
  local: z.string().trim().min(2, 'informe o local da ocorrência').max(300),
  queixaPrincipal: z.string().trim().min(2, 'informe a queixa principal').max(300),
  observacoes: texto(4000),
  triagem: z
    .object({ protocolo: z.enum(PROTOCOLOS), classificacao: z.enum(CLASSIFICACOES) })
    .refine((t) => classificacaoValida(t.protocolo, t.classificacao), {
      message: 'classificação não existe no protocolo escolhido',
      path: ['classificacao'],
    }),
  glasgow: z
    .object({
      ocular: z.number().int().min(1).max(4),
      verbal: z.number().int().min(1).max(5),
      motora: z.number().int().min(1).max(6),
      total: z.number().int().min(3).max(15),
    })
    .refine((g) => g.total === g.ocular + g.verbal + g.motora, {
      message: 'total de Glasgow deve ser a soma ocular + verbal + motora',
      path: ['total'],
    }),
  sinaisVitais: sinaisVitaisSchema,
  medicamentos: z
    .array(
      z.object({
        id: uuid,
        medicamentoId: uuid,
        dose: z.number().positive('dose deve ser maior que zero'),
        via: z.enum(VIAS),
        horario: dataHora,
      }),
    )
    .max(50)
    .default([]),
  profissionalNome: z.string().trim().min(2).max(200),
  ...meta,
});
export type AtendimentoInput = z.infer<typeof atendimentoSchema>;

export const logBatchSchema = z.object({
  dispositivoId: z.string().trim().min(1).max(64),
  logs: z
    .array(z.object({ id: uuid, dataHora, profissionalId: uuid.nullish(), acao: z.string().min(1).max(40), detalhes: z.record(z.unknown()).nullish() }))
    .min(1)
    .max(500),
});

export function camposDoErro(err: z.ZodError): { campo: string; mensagem: string }[] {
  return err.issues.map((i) => ({ campo: i.path.join('.') || '(corpo)', mensagem: i.message }));
}
