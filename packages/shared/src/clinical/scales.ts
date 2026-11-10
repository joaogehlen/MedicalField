import type { Classificacao, ProtocoloTriagem } from '../domain';

/* ------------------------------ Escala de Glasgow ------------------------------ */

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

export function glasgowGravidade(total: number): 'Leve' | 'Moderado' | 'Grave' {
  if (total >= 13) return 'Leve';
  if (total >= 9) return 'Moderado';
  return 'Grave';
}

/* ---------------------------------- Triagem ----------------------------------- */

export const CLASSIFICACOES_POR_PROTOCOLO: Record<ProtocoloTriagem, readonly Classificacao[]> = {
  START: ['VERMELHO', 'AMARELO', 'VERDE', 'PRETO'],
  MANCHESTER: ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL'],
};

const SIGNIFICADO: Record<ProtocoloTriagem, Partial<Record<Classificacao, string>>> = {
  START: { VERMELHO: 'Imediato', AMARELO: 'Retardado', VERDE: 'Leve', PRETO: 'Óbito / expectante' },
  MANCHESTER: { VERMELHO: 'Emergência', LARANJA: 'Muito urgente', AMARELO: 'Urgente', VERDE: 'Pouco urgente', AZUL: 'Não urgente' },
};

export const ROTULO_CLASSIFICACAO: Record<Classificacao, string> = {
  VERMELHO: 'Vermelho',
  LARANJA: 'Laranja',
  AMARELO: 'Amarelo',
  VERDE: 'Verde',
  AZUL: 'Azul',
  PRETO: 'Preto',
};

export function significadoClassificacao(protocolo: ProtocoloTriagem, c: Classificacao): string {
  return SIGNIFICADO[protocolo][c] ?? ROTULO_CLASSIFICACAO[c];
}

export function classificacaoValida(protocolo: ProtocoloTriagem, c: Classificacao): boolean {
  return CLASSIFICACOES_POR_PROTOCOLO[protocolo].includes(c);
}

/* ------------------------------- Sinais vitais -------------------------------- */

export const CAMPOS_VITAIS = [
  { campo: 'paSistolica', rotulo: 'PA sistólica', unidade: 'mmHg', min: 0, max: 300 },
  { campo: 'paDiastolica', rotulo: 'PA diastólica', unidade: 'mmHg', min: 0, max: 200 },
  { campo: 'fc', rotulo: 'Freq. cardíaca', unidade: 'bpm', min: 0, max: 300 },
  { campo: 'fr', rotulo: 'Freq. respiratória', unidade: 'irpm', min: 0, max: 80 },
  { campo: 'spo2', rotulo: 'Saturação O₂', unidade: '%', min: 0, max: 100 },
  { campo: 'temperatura', rotulo: 'Temperatura', unidade: '°C', min: 25, max: 45 },
  { campo: 'glicemia', rotulo: 'Glicemia', unidade: 'mg/dL', min: 0, max: 1500 },
] as const;

export type CampoVital = (typeof CAMPOS_VITAIS)[number]['campo'];
