/**
 * Tipos do domínio MedicalField, compartilhados entre cliente, portal e clinical-service.
 */

export const TIPOS_REGISTRO = ['CRM', 'COREN', 'SOCORRISTA'] as const;
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number];

export const PAPEIS = ['MEDICO', 'ENFERMEIRO', 'SOCORRISTA', 'ADMIN'] as const;
export type Papel = (typeof PAPEIS)[number];

export const PROTOCOLOS = ['START', 'MANCHESTER'] as const;
export type ProtocoloTriagem = (typeof PROTOCOLOS)[number];

export const CLASSIFICACOES = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL', 'PRETO'] as const;
export type Classificacao = (typeof CLASSIFICACOES)[number];

export const VIAS = ['IV', 'IM', 'SC', 'VO', 'SL', 'IO', 'INALATORIA', 'NASAL'] as const;
export type ViaAdministracao = (typeof VIAS)[number];

export const SEXOS = ['M', 'F', 'O'] as const;
export type Sexo = (typeof SEXOS)[number];

export const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/** Metadados de sincronização de todo registro criado no dispositivo. */
export interface SyncMeta {
  /** Versão no servidor; ausente enquanto o registro só existe no aparelho. */
  version?: number;
  /** Cursor global de mudanças (servidor). */
  changeSeq?: number;
  /** Versão do servidor sobre a qual a edição foi feita (null = criação). */
  baseVersion?: number | null;
  /** Momento da edição no aparelho (usado na resolução de conflitos). */
  atualizadoEmCliente: string;
  /** Profissional que fez o registro. */
  registradoPor: string;
  dispositivoId: string;
  criadoOffline?: boolean;
  sincronizadoEm?: string | null;
}

export interface Pessoa extends SyncMeta {
  id: string;
  nome: string;
  cpf?: string | null;
  dataNascimento?: string | null;
  sexo?: Sexo | null;
  telefone?: string | null;
  email?: string | null;
  contatoNome?: string | null;
  contatoEmail?: string | null;
}

export interface Prontuario extends SyncMeta {
  id: string;
  pessoaId: string;
  tipoSanguineo?: string | null;
  alergias: string[];
  comorbidades: string[];
  observacoes?: string | null;
}

export interface Glasgow {
  ocular: number;
  verbal: number;
  motora: number;
  total: number;
}

export interface Triagem {
  protocolo: ProtocoloTriagem;
  classificacao: Classificacao;
}

export interface SinaisVitais {
  paSistolica?: number | null;
  paDiastolica?: number | null;
  fc?: number | null;
  fr?: number | null;
  spo2?: number | null;
  temperatura?: number | null;
  glicemia?: number | null;
}

export interface MedicamentoAdministrado {
  id: string;
  medicamentoId: string;
  dose: number;
  via: ViaAdministracao;
  horario: string;
}

export interface Atendimento extends SyncMeta {
  id: string;
  pessoaId: string;
  prontuarioId: string;
  dataHora: string;
  local: string;
  queixaPrincipal: string;
  observacoes?: string | null;
  triagem: Triagem;
  glasgow: Glasgow;
  sinaisVitais: SinaisVitais;
  medicamentos: MedicamentoAdministrado[];
  /** Nome e registro de quem atendeu, como aparece na ficha (ex.: "Dra. Ana Souza · CRM 12345/RS"). */
  profissionalNome: string;
}

export interface Medicamento {
  id: string;
  nome: string;
  apresentacao: string;
  unidade: string;
  viasPermitidas: ViaAdministracao[];
  doseMaxima: number;
  alergenos: string[];
  ativo: boolean;
  changeSeq?: number;
}

export interface Profissional {
  id: string;
  nome: string;
  tipoRegistro: TipoRegistro;
  numeroRegistro: string;
  uf?: string | null;
  papel: Papel;
  email?: string | null;
  ativo: boolean;
}

/** Atendimento com paciente, prontuário e catálogo (GET /atendimento/detalhe/{id}). */
export interface AtendimentoDetalhe extends Atendimento {
  pessoa: Pessoa;
  prontuario: Prontuario;
  medicamentosCatalogo: Medicamento[];
}

/** Linha da listagem de atendimentos. */
export interface AtendimentoResumo {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  dataHora: string;
  queixaPrincipal: string;
  local: string;
  triagem: Triagem;
  profissionalNome: string;
  criadoOffline: boolean;
  sincronizadoEm?: string | null;
}

export interface ProntuarioResumo extends Prontuario {
  pessoa: Pessoa;
  totalAtendimentos: number;
}

export interface ProntuarioDetalhe extends ProntuarioResumo {
  atendimentos: AtendimentoResumo[];
}

/** Rótulo do registro profissional, ex.: "CRM 12345/RS". */
export function registroProfissional(p: Pick<Profissional, 'tipoRegistro' | 'numeroRegistro' | 'uf'>): string {
  return `${p.tipoRegistro} ${p.numeroRegistro}${p.uf ? `/${p.uf}` : ''}`;
}
