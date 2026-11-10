/**
 * Regras de segurança clínica para administrar medicamentos — padrão Chain of
 * Responsibility. A mesma cadeia roda no aparelho (offline) e no clinical-service.
 */
import type { Medicamento, ViaAdministracao } from '../domain';
import { normalizarTexto } from '../text';

export interface ContextoAdministracao {
  medicamento: Medicamento;
  dose: number;
  via: ViaAdministracao;
  /** Alergias registradas no prontuário do paciente. */
  alergias: string[];
}

export abstract class RegraSeguranca {
  private proxima: RegraSeguranca | null = null;

  encadear(proxima: RegraSeguranca): RegraSeguranca {
    this.proxima = proxima;
    return proxima;
  }

  /** Avalia esta regra e repassa para a próxima, acumulando os alertas. */
  avaliar(ctx: ContextoAdministracao, alertas: string[] = []): string[] {
    const alerta = this.verificar(ctx);
    if (alerta) alertas.push(alerta);
    return this.proxima ? this.proxima.avaliar(ctx, alertas) : alertas;
  }

  protected abstract verificar(ctx: ContextoAdministracao): string | null;
}

export class ViaRule extends RegraSeguranca {
  protected verificar({ medicamento, via }: ContextoAdministracao) {
    return medicamento.viasPermitidas.includes(via)
      ? null
      : `Via ${via} não permitida para ${medicamento.nome} (use ${medicamento.viasPermitidas.join(', ')}).`;
  }
}

export class DoseMaximaRule extends RegraSeguranca {
  protected verificar({ medicamento, dose }: ContextoAdministracao) {
    return dose <= medicamento.doseMaxima
      ? null
      : `Dose de ${dose} ${medicamento.unidade} acima da máxima de ${medicamento.nome} (${medicamento.doseMaxima} ${medicamento.unidade}).`;
  }
}

export class AlergiaRule extends RegraSeguranca {
  protected verificar({ medicamento, alergias }: ContextoAdministracao) {
    const termos = [medicamento.nome, ...medicamento.alergenos].map(normalizarTexto);
    const alergia = alergias.find((a) => {
      const n = normalizarTexto(a);
      return n.length > 2 && termos.some((t) => t.includes(n) || n.includes(t));
    });
    return alergia ? `Paciente alérgico a ${alergia}: ${medicamento.nome} não pode ser administrado.` : null;
  }
}

/** Via → dose máxima → alergia. */
export function avaliarAdministracao(ctx: ContextoAdministracao): string[] {
  const cadeia = new ViaRule();
  cadeia.encadear(new DoseMaximaRule()).encadear(new AlergiaRule());
  return cadeia.avaliar(ctx);
}
