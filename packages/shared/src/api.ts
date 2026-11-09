/** Contratos de requisição/resposta das APIs. */
import type {
  Atendimento,
  Hospital,
  Medicamento,
  Papel,
  Pessoa,
  Profissional,
  Prontuario,
  TipoRegistro,
  Viatura,
} from './domain';

export interface LoginRequest {
  tipoRegistro: TipoRegistro;
  numeroRegistro: string;
  uf?: string | null;
  senha: string;
  dispositivoId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  profissional: Profissional;
}

/** Claims do JWT emitido pelo identity-service. */
export interface TokenClaims {
  sub: string;
  nome: string;
  papel: Papel;
  tipoRegistro: TipoRegistro;
  registro: string;
  exp: number;
  iat: number;
  jti: string;
  iss: string;
}

export const RESULTADOS_UPSERT = ['CRIADO', 'ATUALIZADO', 'MESCLADO', 'MESCLADO_EM'] as const;
export type ResultadoUpsert = (typeof RESULTADOS_UPSERT)[number];

export interface UpsertResponse<T> {
  resultado: ResultadoUpsert;
  registro: T;
  /** Presente quando resultado = MESCLADO_EM. */
  idCanonico?: string;
}

export interface PullResponse {
  medicamentos: Medicamento[];
  hospitais: Hospital[];
  viaturas: Viatura[];
  pessoas: Pessoa[];
  prontuarios: Prontuario[];
  atendimentos: Atendimento[];
  proximoCursor: number;
  temMais: boolean;
}

export interface Page<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  total: number;
}

export const ACOES_LOG = [
  'LOGIN_OFFLINE',
  'LOGIN_ONLINE',
  'REDE_ALTERADA',
  'PESSOA_CRIADA',
  'PESSOA_ALTERADA',
  'PRONTUARIO_CRIADO',
  'PRONTUARIO_ALTERADO',
  'ATENDIMENTO_CRIADO',
  'ATENDIMENTO_ALTERADO',
  'ATENDIMENTO_FINALIZADO',
  'ALERTA_CLINICO_EXIBIDO',
  'ALERTA_CLINICO_IGNORADO',
  'SINCRONIZACAO_CONCLUIDA',
  'ERRO_SINCRONIZACAO',
] as const;
export type AcaoLog = (typeof ACOES_LOG)[number];

export interface LogCliente {
  id: string;
  dataHora: string;
  nivel: 'INFO' | 'WARN' | 'ERROR';
  profissionalId?: string | null;
  acao: AcaoLog;
  entidade?: string | null;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown> | null;
}

export interface LogBatchRequest {
  dispositivoId: string;
  logs: LogCliente[];
}

export interface LogClienteRegistro extends LogCliente {
  dispositivoId: string;
  recebidoEm: string;
}

export interface AccessLog {
  id: number;
  servico: string;
  dataHora: string;
  requestId?: string | null;
  ipCliente?: string | null;
  profissionalId?: string | null;
  metodo: string;
  rota: string;
  caminho: string;
  statusCode: number;
  tempoMs: number;
  userAgent?: string | null;
}

export interface SyncConflito {
  id: string;
  opId?: string | null;
  entidade: string;
  entidadeId: string;
  estrategia: string;
  versaoServidor: number;
  versaoBaseCliente?: number | null;
  valorServidor: unknown;
  valorRecebido: unknown;
  valorResultante: unknown;
  resolvidoEm: string;
}

export interface Destinatario {
  email: string;
  nome?: string | null;
  tipo: 'PACIENTE' | 'FAMILIAR' | 'HOSPITAL';
}

export interface EnvioEmailRequest {
  destinatarios: Destinatario[];
  mensagem?: string | null;
}

export interface EnvioEmail {
  id: string;
  atendimentoId: string;
  destinatarioEmail: string;
  destinatarioNome?: string | null;
  tipo: Destinatario['tipo'];
  status: 'PENDENTE' | 'ENVIADO' | 'FALHOU';
  messageId?: string | null;
  erro?: string | null;
  criadoEm: string;
  enviadoEm?: string | null;
}

export interface EnvioEmailResponse {
  envios: EnvioEmail[];
}

/** RFC 7807 — Problem Details. */
export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  codigo: string;
  requestId?: string;
  campos?: { campo: string; mensagem: string }[];
  alertas?: unknown[];
}
