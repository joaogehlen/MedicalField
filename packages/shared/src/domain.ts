/**
 * Tipos do domínio MedicalField. São a fonte única de verdade para o formato
 * dos dados trafegados entre cliente, portal e clinical-service.
 */

export const TIPOS_REGISTRO = ['CRM', 'COREN', 'SOCORRISTA'] as const;
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number];

export const PAPEIS = ['MEDICO', 'ENFERMEIRO', 'SOCORRISTA', 'ADMIN'] as const;
export type Papel = (typeof PAPEIS)[number];

export const PROTOCOLOS = ['START', 'MANCHESTER'] as const;
export type ProtocoloTriagem = (typeof PROTOCOLOS)[number];

export const CLASSIFICACOES = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL', 'PRETO'] as const;
export type Classificacao = (typeof CLASSIFICACOES)[number];

export const STATUS_ATENDIMENTO = ['RASCUNHO', 'FINALIZADO'] as const;
export type StatusAtendimento = (typeof STATUS_ATENDIMENTO)[number];

export const VIAS = ['IV', 'IM', 'SC', 'VO', 'SL', 'IO', 'INALATORIA', 'NASAL', 'RETAL', 'TOPICA'] as const;
export type ViaAdministracao = (typeof VIAS)[number];

export const SEXOS = ['M', 'F', 'O'] as const;
export type Sexo = (typeof SEXOS)[number];

export const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const TIPOS_VIATURA = ['USA', 'USB', 'RESGATE'] as const;
export type TipoViatura = (typeof TIPOS_VIATURA)[number];

/** Metadados de sincronização presentes em toda entidade que nasce no dispositivo. */
export interface SyncMeta {
  /** Versão no servidor (incrementa a cada alteração). Ausente em registros nunca sincronizados. */
  version?: number;
  /** Cursor global de mudanças (servidor). */
  changeSeq?: number;
  /** Versão do servidor sobre a qual a edição local foi feita (null = criação). */
  baseVersion?: number | null;
  /** Hora clínica informada pelo profissional no dispositivo (usada no last-write-wins). */
  atualizadoEmCliente: string;
  /** Profissional que registrou (pode ter sido offline). */
  registradoPor: string;
  /** Profissional do token que enviou ao servidor. */
  sincronizadoPor?: string | null;
  sincronizadoEm?: string | null;
  dispositivoId: string;
  criadoOffline?: boolean;
}

export interface Pessoa extends SyncMeta {
  id: string;
  nome: string;
  identificada: boolean;
  cpf?: string | null;
  dataNascimento?: string | null;
  sexo?: Sexo | null;
  telefone?: string | null;
  email?: string | null;
  contatoNome?: string | null;
  contatoParentesco?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  /** Sinais físicos de uma vítima não identificada. */
  caracteristicas?: string | null;
  /** Quando duplicada (mesmo CPF), aponta para a pessoa canônica. */
  mescladaEm?: string | null;
}

export interface Prontuario extends SyncMeta {
  id: string;
  pessoaId: string;
  tipoSanguineo?: string | null;
  alergias: string[];
  comorbidades: string[];
  medicamentosUsoContinuo: string[];
  observacoes?: string | null;
  mescladoEm?: string | null;
}

export interface SinalVital {
  id: string;
  aferidoEm: string;
  paSistolica?: number | null;
  paDiastolica?: number | null;
  fc?: number | null;
  fr?: number | null;
  spo2?: number | null;
  temperatura?: number | null;
  glicemia?: number | null;
  /** Escala numérica de dor, 0 a 10. */
  dor?: number | null;
}

export interface AlertaIgnorado {
  codigo: string;
  justificativa: string;
}

export interface AdministracaoMedicamento {
  id: string;
  medicamentoId: string;
  dose: number;
  unidade: string;
  via: ViaAdministracao;
  administradoEm: string;
  administradoPor: string;
  observacao?: string | null;
  alertasIgnorados: AlertaIgnorado[];
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

export interface LocalOcorrencia {
  descricao: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Adendo {
  id: string;
  texto: string;
  autorId: string;
  criadoEm: string;
}

export interface Atendimento extends SyncMeta {
  id: string;
  pessoaId: string;
  prontuarioId: string;
  viaturaId?: string | null;
  hospitalDestinoId?: string | null;
  status: StatusAtendimento;
  iniciadoEm: string;
  finalizadoEm?: string | null;
  local: LocalOcorrencia;
  queixaPrincipal: string;
  descricao?: string | null;
  triagem: Triagem;
  glasgow: Glasgow;
  sinaisVitais: SinalVital[];
  medicamentos: AdministracaoMedicamento[];
  procedimentos: string[];
  adendos?: Adendo[];
}

export interface Medicamento {
  id: string;
  nome: string;
  principioAtivo: string;
  apresentacao: string;
  unidade: string;
  viasPermitidas: ViaAdministracao[];
  doseMaximaDose: number;
  doseMaximaDiaria?: number | null;
  intervaloMinimoHoras?: number | null;
  controlado: boolean;
  contraindicacoes: string[];
  alergenos: string[];
  ativo: boolean;
  version?: number;
  changeSeq?: number;
}

export interface Hospital {
  id: string;
  nome: string;
  cidade: string;
  telefone?: string | null;
  ativo: boolean;
  changeSeq?: number;
}

export interface Viatura {
  id: string;
  prefixo: string;
  tipo: TipoViatura;
  base: string;
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

/** Atendimento com os dados relacionados, como devolvido por GET /atendimento/detalhe/{id}. */
export interface AtendimentoDetalhe extends Atendimento {
  pessoa: Pessoa;
  prontuario: Prontuario;
  hospitalDestino?: Hospital | null;
  viatura?: Viatura | null;
  medicamentosCatalogo: Medicamento[];
}

/** Linha da listagem de atendimentos (portal). */
export interface AtendimentoResumo {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  prontuarioId: string;
  status: StatusAtendimento;
  iniciadoEm: string;
  queixaPrincipal: string;
  triagem: Triagem;
  glasgowTotal: number;
  localDescricao: string;
  registradoPor: string;
  criadoOffline: boolean;
  sincronizadoEm?: string | null;
  hospitalDestinoNome?: string | null;
}

export interface ProntuarioResumo extends Prontuario {
  pessoa: Pick<Pessoa, 'id' | 'nome' | 'cpf' | 'dataNascimento' | 'identificada' | 'sexo'>;
  totalAtendimentos: number;
}
