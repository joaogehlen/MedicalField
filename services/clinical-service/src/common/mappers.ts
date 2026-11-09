/** Conversões entre linhas do banco (snake_case) e o domínio compartilhado (camelCase). */
import type { Atendimento, Hospital, Medicamento, Pessoa, Prontuario, Viatura } from '@medicalfield/shared';

type Linha = Record<string, any>;

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

const meta = (r: Linha) => ({
  version: r.version,
  changeSeq: r.change_seq,
  atualizadoEmCliente: iso(r.atualizado_em_cliente)!,
  registradoPor: r.registrado_por,
  sincronizadoPor: r.sincronizado_por ?? null,
  dispositivoId: r.dispositivo_id,
  criadoOffline: r.criado_offline,
});

export function pessoaDeLinha(r: Linha): Pessoa {
  return {
    id: r.id,
    nome: r.nome,
    identificada: r.identificada,
    cpf: r.cpf,
    dataNascimento: r.data_nascimento,
    sexo: r.sexo,
    telefone: r.telefone,
    email: r.email,
    contatoNome: r.contato_nome,
    contatoParentesco: r.contato_parentesco,
    contatoTelefone: r.contato_telefone,
    contatoEmail: r.contato_email,
    caracteristicas: r.caracteristicas,
    mescladaEm: r.mesclada_em,
    ...meta(r),
  };
}

export function prontuarioDeLinha(r: Linha): Prontuario {
  return {
    id: r.id,
    pessoaId: r.pessoa_id,
    tipoSanguineo: r.tipo_sanguineo,
    alergias: r.alergias ?? [],
    comorbidades: r.comorbidades ?? [],
    medicamentosUsoContinuo: r.medicamentos_uso_continuo ?? [],
    observacoes: r.observacoes,
    mescladoEm: r.mesclado_em,
    ...meta(r),
  };
}

/** Cabeçalho do atendimento; sinais e medicamentos são preenchidos à parte. */
export function atendimentoDeLinha(r: Linha): Atendimento {
  return {
    id: r.id,
    pessoaId: r.pessoa_id,
    prontuarioId: r.prontuario_id,
    viaturaId: r.viatura_id,
    hospitalDestinoId: r.hospital_destino_id,
    status: r.status,
    iniciadoEm: iso(r.iniciado_em)!,
    finalizadoEm: iso(r.finalizado_em),
    local: { descricao: r.local_descricao, latitude: r.latitude, longitude: r.longitude },
    queixaPrincipal: r.queixa_principal,
    descricao: r.descricao,
    triagem: { protocolo: r.triagem_protocolo, classificacao: r.triagem_classificacao },
    glasgow: { ocular: r.glasgow_ocular, verbal: r.glasgow_verbal, motora: r.glasgow_motora, total: r.glasgow_total },
    sinaisVitais: [],
    medicamentos: [],
    procedimentos: r.procedimentos ?? [],
    sincronizadoEm: iso(r.sincronizado_em),
    ...meta(r),
  };
}

export function sinalDeLinha(r: Linha) {
  return {
    id: r.id,
    aferidoEm: iso(r.aferido_em)!,
    paSistolica: r.pa_sistolica,
    paDiastolica: r.pa_diastolica,
    fc: r.fc,
    fr: r.fr,
    spo2: r.spo2,
    temperatura: r.temperatura,
    glicemia: r.glicemia,
    dor: r.dor,
  };
}

export function administracaoDeLinha(r: Linha) {
  return {
    id: r.id,
    medicamentoId: r.medicamento_id,
    dose: r.dose,
    unidade: r.unidade,
    via: r.via,
    administradoEm: iso(r.administrado_em)!,
    administradoPor: r.administrado_por,
    observacao: r.observacao,
    alertasIgnorados: r.alertas_ignorados ?? [],
  };
}

export function medicamentoDeLinha(r: Linha): Medicamento {
  return {
    id: r.id,
    nome: r.nome,
    principioAtivo: r.principio_ativo,
    apresentacao: r.apresentacao,
    unidade: r.unidade,
    viasPermitidas: r.vias_permitidas ?? [],
    doseMaximaDose: r.dose_maxima_dose,
    doseMaximaDiaria: r.dose_maxima_diaria,
    intervaloMinimoHoras: r.intervalo_minimo_horas,
    controlado: r.controlado,
    contraindicacoes: r.contraindicacoes ?? [],
    alergenos: r.alergenos ?? [],
    ativo: r.ativo,
    version: r.version,
    changeSeq: r.change_seq,
  };
}

export function hospitalDeLinha(r: Linha): Hospital {
  return { id: r.id, nome: r.nome, cidade: r.cidade, telefone: r.telefone, ativo: r.ativo, changeSeq: r.change_seq };
}

export function viaturaDeLinha(r: Linha): Viatura {
  return { id: r.id, prefixo: r.prefixo, tipo: r.tipo, base: r.base, ativo: r.ativo, changeSeq: r.change_seq };
}
