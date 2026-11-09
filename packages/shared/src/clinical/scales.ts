import type { Classificacao, ProtocoloTriagem } from '../domain';

/* ----------------------------- Escala de Glasgow ----------------------------- */

export const GLASGOW_OCULAR = [
  { valor: 4, descricao: 'Espontânea' },
  { valor: 3, descricao: 'Ao estímulo verbal' },
  { valor: 2, descricao: 'Ao estímulo de pressão' },
  { valor: 1, descricao: 'Ausente' },
] as const;

export const GLASGOW_VERBAL = [
  { valor: 5, descricao: 'Orientado' },
  { valor: 4, descricao: 'Confuso' },
  { valor: 3, descricao: 'Palavras' },
  { valor: 2, descricao: 'Sons' },
  { valor: 1, descricao: 'Ausente' },
] as const;

export const GLASGOW_MOTORA = [
  { valor: 6, descricao: 'Obedece comandos' },
  { valor: 5, descricao: 'Localiza estímulo' },
  { valor: 4, descricao: 'Flexão normal' },
  { valor: 3, descricao: 'Flexão anormal' },
  { valor: 2, descricao: 'Extensão' },
  { valor: 1, descricao: 'Ausente' },
] as const;

export function glasgowTotal(ocular: number, verbal: number, motora: number): number {
  return ocular + verbal + motora;
}

/** Interpretação clínica usual do escore total. */
export function glasgowGravidade(total: number): 'LEVE' | 'MODERADO' | 'GRAVE' {
  if (total >= 13) return 'LEVE';
  if (total >= 9) return 'MODERADO';
  return 'GRAVE';
}

/* ------------------------------ Triagem -------------------------------------- */

export const CLASSIFICACOES_POR_PROTOCOLO: Record<ProtocoloTriagem, readonly Classificacao[]> = {
  START: ['VERMELHO', 'AMARELO', 'VERDE', 'PRETO'],
  MANCHESTER: ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL'],
};

export interface InfoClassificacao {
  rotulo: string;
  /** Significado da cor em cada protocolo. */
  start?: string;
  manchester?: string;
  /** Tempo-alvo de atendimento no Manchester. */
  tempoAlvo?: string;
}

export const INFO_CLASSIFICACAO: Record<Classificacao, InfoClassificacao> = {
  VERMELHO: { rotulo: 'Vermelho', start: 'Imediato', manchester: 'Emergência', tempoAlvo: 'imediato' },
  LARANJA: { rotulo: 'Laranja', manchester: 'Muito urgente', tempoAlvo: '10 min' },
  AMARELO: { rotulo: 'Amarelo', start: 'Retardado', manchester: 'Urgente', tempoAlvo: '60 min' },
  VERDE: { rotulo: 'Verde', start: 'Leve', manchester: 'Pouco urgente', tempoAlvo: '120 min' },
  AZUL: { rotulo: 'Azul', manchester: 'Não urgente', tempoAlvo: '240 min' },
  PRETO: { rotulo: 'Preto', start: 'Óbito / expectante' },
};

export function significadoClassificacao(protocolo: ProtocoloTriagem, c: Classificacao): string {
  const info = INFO_CLASSIFICACAO[c];
  return (protocolo === 'START' ? info.start : info.manchester) ?? info.rotulo;
}

export function classificacaoValida(protocolo: ProtocoloTriagem, c: Classificacao): boolean {
  return CLASSIFICACOES_POR_PROTOCOLO[protocolo].includes(c);
}

/* --------------------------- Sinais vitais ----------------------------------- */

export interface FaixaVital {
  rotulo: string;
  unidade: string;
  /** Limites aceitos na digitação (fisiologicamente possíveis). */
  min: number;
  max: number;
  /** Faixa de referência de adulto em repouso, para destacar valores alterados. */
  normalMin?: number;
  normalMax?: number;
  passo?: number;
}

export const FAIXAS_VITAIS = {
  paSistolica: { rotulo: 'PA sistólica', unidade: 'mmHg', min: 0, max: 300, normalMin: 90, normalMax: 139 },
  paDiastolica: { rotulo: 'PA diastólica', unidade: 'mmHg', min: 0, max: 200, normalMin: 60, normalMax: 89 },
  fc: { rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 0, max: 300, normalMin: 60, normalMax: 100 },
  fr: { rotulo: 'Frequência respiratória', unidade: 'irpm', min: 0, max: 80, normalMin: 12, normalMax: 20 },
  spo2: { rotulo: 'Saturação O₂', unidade: '%', min: 0, max: 100, normalMin: 94, normalMax: 100 },
  temperatura: { rotulo: 'Temperatura', unidade: '°C', min: 25, max: 45, normalMin: 35.5, normalMax: 37.7, passo: 0.1 },
  glicemia: { rotulo: 'Glicemia', unidade: 'mg/dL', min: 0, max: 1500, normalMin: 70, normalMax: 180 },
  dor: { rotulo: 'Dor', unidade: '0–10', min: 0, max: 10 },
} as const satisfies Record<string, FaixaVital>;

export type CampoVital = keyof typeof FAIXAS_VITAIS;

export function vitalAlterado(campo: CampoVital, valor: number | null | undefined): boolean {
  if (valor === null || valor === undefined) return false;
  const f: FaixaVital = FAIXAS_VITAIS[campo];
  if (f.normalMin !== undefined && valor < f.normalMin) return true;
  if (f.normalMax !== undefined && valor > f.normalMax) return true;
  return false;
}
