/**
 * PADRÃO CHAIN OF RESPONSIBILITY — "a fila de fiscais"
 *
 * Antes de dar um remédio, o pedido passa por uma corrente de fiscais:
 *   ViaRule → DoseMaximaRule → AlergiaRule
 * Cada fiscal confere só a sua parte, anota um alerta se achar problema e passa adiante.
 * Lista de alertas vazia = pode administrar. A mesma corrente roda no aparelho (offline)
 * e no clinical-service. Regra nova = um elo novo na corrente.
 */
import type { Medicamento, ViaAdministracao } from '../domain';
import { normalizarTexto } from '../text';

// O PEDIDO que passa pela corrente: qual remédio, quanto, por qual via e as alergias do paciente.
export interface ContextoAdministracao {
  medicamento: Medicamento;
  dose: number;
  via: ViaAdministracao;
  /** Alergias registradas no prontuário do paciente. */
  alergias: string[];
}

// O ELO DA CORRENTE
// Todo fiscal tem um "próximo". avaliar() confere a regra deste fiscal (verificar), guarda o alerta
// se houver problema e passa o pedido adiante. O último fiscal devolve a lista de alertas.
export abstract class RegraSeguranca {
  private proxima: RegraSeguranca | null = null;

  // Liga este fiscal ao próximo da fila.
  encadear(proxima: RegraSeguranca): RegraSeguranca {
    this.proxima = proxima;
    return proxima;
  }

  // Confere a minha parte e passo para o próximo fiscal.
  avaliar(ctx: ContextoAdministracao, alertas: string[] = []): string[] {
    const alerta = this.verificar(ctx);
    if (alerta) alertas.push(alerta);
    return this.proxima ? this.proxima.avaliar(ctx, alertas) : alertas;
  }

  protected abstract verificar(ctx: ContextoAdministracao): string | null;
}

// Fiscal 1: essa via (IV, IM, VO...) é permitida para o remédio?
export class ViaRule extends RegraSeguranca {
  protected verificar({ medicamento, via }: ContextoAdministracao) {
    return medicamento.viasPermitidas.includes(via)
      ? null
      : `Via ${via} não permitida para ${medicamento.nome} (use ${medicamento.viasPermitidas.join(', ')}).`;
  }
}

// Fiscal 2: a dose passa da máxima?
export class DoseMaximaRule extends RegraSeguranca {
  protected verificar({ medicamento, dose }: ContextoAdministracao) {
    return dose <= medicamento.doseMaxima
      ? null
      : `Dose de ${dose} ${medicamento.unidade} acima da máxima de ${medicamento.nome} (${medicamento.doseMaxima} ${medicamento.unidade}).`;
  }
}

// Fiscal 3: o paciente é alérgico a esse remédio (ou a um componente dele)?
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

// MONTAR E USAR A CORRENTE
// Liga os fiscais na ordem via → dose máxima → alergia e passa o pedido pelo primeiro.
// Lista vazia = pode administrar. Esta mesma função é chamada no celular (AtendimentoForm.tsx)
// e no servidor (atendimento.service.ts).
export function avaliarAdministracao(ctx: ContextoAdministracao): string[] {
  const cadeia = new ViaRule();
  cadeia.encadear(new DoseMaximaRule()).encadear(new AlergiaRule());
  return cadeia.avaliar(ctx);
}
