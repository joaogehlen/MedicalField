/**
 * Regras de segurança clínica para administração de medicamentos.
 *
 * Padrão Chain of Responsibility: cada regra avalia o contexto, registra um alerta
 * se for o caso e repassa para a próxima. O mesmo código roda no cliente (offline,
 * antes de gravar) e no clinical-service (revalidação ao sincronizar).
 */
import type { AdministracaoMedicamento, AlertaIgnorado, Medicamento, Papel, ViaAdministracao } from '../domain';
import { normalizarTexto } from '../text';

export type CodigoAlerta =
  | 'MEDICAMENTO_INATIVO'
  | 'VIA_NAO_PERMITIDA'
  | 'DOSE_MAXIMA'
  | 'DOSE_DIARIA'
  | 'ALERGIA'
  | 'INTERVALO_MINIMO'
  | 'CONTROLADO';

export interface AlertaClinico {
  codigo: CodigoAlerta;
  severidade: 'BLOQUEANTE' | 'AVISO';
  /** Bloqueantes ignoráveis exigem justificativa registrada; os não ignoráveis impedem o registro. */
  ignoravel: boolean;
  mensagem: string;
}

export interface ContextoAdministracao {
  medicamento: Medicamento;
  dose: number;
  via: ViaAdministracao;
  administradoEm: string;
  /** Alergias do prontuário do paciente. */
  alergias: string[];
  /** Demais administrações do mesmo atendimento (sem a que está sendo avaliada). */
  administracoesAnteriores: Pick<AdministracaoMedicamento, 'medicamentoId' | 'dose' | 'administradoEm'>[];
  papel?: Papel;
}

export abstract class RegraSeguranca {
  private proxima: RegraSeguranca | null = null;

  /** Encadeia a próxima regra e a devolve, permitindo `a.encadear(b).encadear(c)`. */
  encadear(proxima: RegraSeguranca): RegraSeguranca {
    this.proxima = proxima;
    return proxima;
  }

  avaliar(ctx: ContextoAdministracao, alertas: AlertaClinico[] = []): AlertaClinico[] {
    const alerta = this.verificar(ctx);
    if (alerta) alertas.push(alerta);
    return this.proxima ? this.proxima.avaliar(ctx, alertas) : alertas;
  }

  protected abstract verificar(ctx: ContextoAdministracao): AlertaClinico | null;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export class MedicamentoInativoRule extends RegraSeguranca {
  protected verificar({ medicamento }: ContextoAdministracao): AlertaClinico | null {
    if (medicamento.ativo) return null;
    return {
      codigo: 'MEDICAMENTO_INATIVO',
      severidade: 'AVISO',
      ignoravel: true,
      mensagem: `${medicamento.nome} está desativado no catálogo.`,
    };
  }
}

export class ViaAdministracaoRule extends RegraSeguranca {
  protected verificar({ medicamento, via }: ContextoAdministracao): AlertaClinico | null {
    if (medicamento.viasPermitidas.includes(via)) return null;
    return {
      codigo: 'VIA_NAO_PERMITIDA',
      severidade: 'BLOQUEANTE',
      ignoravel: false,
      mensagem: `Via ${via} não é permitida para ${medicamento.nome} (permitidas: ${medicamento.viasPermitidas.join(', ')}).`,
    };
  }
}

export class DoseMaximaRule extends RegraSeguranca {
  protected verificar({ medicamento, dose }: ContextoAdministracao): AlertaClinico | null {
    if (dose <= medicamento.doseMaximaDose) return null;
    return {
      codigo: 'DOSE_MAXIMA',
      severidade: 'BLOQUEANTE',
      ignoravel: false,
      mensagem: `Dose de ${fmt(dose)} ${medicamento.unidade} excede a dose máxima por administração de ${medicamento.nome} (${fmt(medicamento.doseMaximaDose)} ${medicamento.unidade}).`,
    };
  }
}

export class DoseDiariaRule extends RegraSeguranca {
  protected verificar({ medicamento, dose, administracoesAnteriores }: ContextoAdministracao): AlertaClinico | null {
    if (!medicamento.doseMaximaDiaria) return null;
    const acumulado =
      administracoesAnteriores.filter((a) => a.medicamentoId === medicamento.id).reduce((s, a) => s + a.dose, 0) + dose;
    if (acumulado <= medicamento.doseMaximaDiaria) return null;
    return {
      codigo: 'DOSE_DIARIA',
      severidade: 'BLOQUEANTE',
      ignoravel: false,
      mensagem: `Total de ${fmt(acumulado)} ${medicamento.unidade} neste atendimento excede a dose máxima diária de ${medicamento.nome} (${fmt(medicamento.doseMaximaDiaria)} ${medicamento.unidade}).`,
    };
  }
}

export class AlergiaRule extends RegraSeguranca {
  protected verificar({ medicamento, alergias }: ContextoAdministracao): AlertaClinico | null {
    const termosMedicamento = [medicamento.nome, medicamento.principioAtivo, ...medicamento.alergenos]
      .map(normalizarTexto)
      .filter(Boolean);
    const alergia = alergias.find((a) => {
      const al = normalizarTexto(a);
      return al.length > 2 && termosMedicamento.some((t) => t.includes(al) || al.includes(t));
    });
    if (!alergia) return null;
    return {
      codigo: 'ALERGIA',
      severidade: 'BLOQUEANTE',
      ignoravel: true,
      mensagem: `Paciente com alergia registrada a "${alergia}". ${medicamento.nome} pode causar reação alérgica.`,
    };
  }
}

export class IntervaloMinimoRule extends RegraSeguranca {
  protected verificar({ medicamento, administradoEm, administracoesAnteriores }: ContextoAdministracao): AlertaClinico | null {
    if (!medicamento.intervaloMinimoHoras) return null;
    const agora = Date.parse(administradoEm);
    const limiteMs = medicamento.intervaloMinimoHoras * 3_600_000;
    const recente = administracoesAnteriores
      .filter((a) => a.medicamentoId === medicamento.id)
      .map((a) => Math.abs(agora - Date.parse(a.administradoEm)))
      .find((dif) => dif < limiteMs);
    if (recente === undefined) return null;
    const minutos = Math.round(recente / 60_000);
    return {
      codigo: 'INTERVALO_MINIMO',
      severidade: 'AVISO',
      ignoravel: true,
      mensagem: `${medicamento.nome} foi administrado há ${minutos} min; intervalo mínimo recomendado é de ${medicamento.intervaloMinimoHoras} h.`,
    };
  }
}

export class ControladoRule extends RegraSeguranca {
  protected verificar({ medicamento, papel }: ContextoAdministracao): AlertaClinico | null {
    if (!medicamento.controlado || !papel || papel === 'MEDICO' || papel === 'ENFERMEIRO') return null;
    return {
      codigo: 'CONTROLADO',
      severidade: 'BLOQUEANTE',
      ignoravel: false,
      mensagem: `${medicamento.nome} é controlado: só médico ou enfermeiro pode registrar a administração.`,
    };
  }
}

/** Monta a cadeia na ordem em que os alertas devem aparecer para o profissional. */
export function criarCadeiaSeguranca(): RegraSeguranca {
  const inicio = new MedicamentoInativoRule();
  inicio
    .encadear(new ControladoRule())
    .encadear(new ViaAdministracaoRule())
    .encadear(new DoseMaximaRule())
    .encadear(new DoseDiariaRule())
    .encadear(new AlergiaRule())
    .encadear(new IntervaloMinimoRule());
  return inicio;
}

export function avaliarAdministracao(ctx: ContextoAdministracao): AlertaClinico[] {
  return criarCadeiaSeguranca().avaliar(ctx);
}

/**
 * Alertas que ainda impedem o registro: bloqueantes não ignoráveis, e bloqueantes
 * ignoráveis sem justificativa registrada.
 */
export function alertasImpeditivos(alertas: AlertaClinico[], ignorados: AlertaIgnorado[] = []): AlertaClinico[] {
  return alertas.filter((a) => {
    if (a.severidade !== 'BLOQUEANTE') return false;
    if (!a.ignoravel) return true;
    const ig = ignorados.find((i) => i.codigo === a.codigo);
    return !ig || ig.justificativa.trim().length < 5;
  });
}
