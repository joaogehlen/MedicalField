/** Contratos das APIs. */
import type { Atendimento, Medicamento, Papel, Pessoa, Profissional, Prontuario, TipoRegistro } from './domain';

export interface LoginRequest {
  tipoRegistro: TipoRegistro;
  numeroRegistro: string;
  uf?: string | null;
  senha: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  profissional: Profissional;
}

/** Claims do JWT emitido pelo identity-service. */
export interface TokenClaims {
  sub: string;
  nome: string;
  papel: Papel;
  registro: string;
  exp: number;
  iat: number;
  iss: string;
}

export type ResultadoUpsert = 'CRIADO' | 'ATUALIZADO' | 'MESCLADO';

export interface UpsertResponse<T> {
  resultado: ResultadoUpsert;
  registro: T;
}

export interface PullResponse {
  medicamentos: Medicamento[];
  pessoas: Pessoa[];
  prontuarios: Prontuario[];
  atendimentos: Atendimento[];
  proximoCursor: number;
}

export interface Page<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  total: number;
}

export interface LogCliente {
  id: string;
  dataHora: string;
  profissionalId?: string | null;
  acao: string;
  detalhes?: Record<string, unknown> | null;
}

export interface LogBatchRequest {
  dispositivoId: string;
  logs: LogCliente[];
}

export interface Destinatario {
  email: string;
  nome?: string | null;
}

export interface EnvioEmailResponse {
  enviadoPara: string;
  messageId: string | null;
}

/** RFC 7807 — Problem Details. */
export interface Problem {
  title: string;
  status: number;
  detail?: string;
  codigo: string;
  requestId?: string;
  campos?: { campo: string; mensagem: string }[];
  alertas?: string[];
}
