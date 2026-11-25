/**
 * PADRÃO STRATEGY — "cada campeonato tem a sua regra de desempate"
 *
 * Problema: dois aparelhos offline editam o mesmo registro. Quando os dois sincronizam, quem vence?
 * Todas as estratégias têm o mesmo método: resolve(servidor, recebido).
 * Cada serviço escolhe a sua e só chama resolve(), sem saber qual algoritmo está rodando:
 *   Pessoa      → LastWriteWinsStrategy (vence a edição mais nova)
 *   Prontuário  → MergeStrategy         (junta as listas: nenhuma alergia se perde)
 *   Atendimento → ServerWinsStrategy    (o que já está na central não muda)
 * Conflito = a edição chegou com baseVersion menor que a versão do banco (houveConflito).
 */
import { uniaoTermos } from '@medicalfield/shared';

export type NomeEstrategia = 'LWW' | 'MESCLA' | 'SERVIDOR_VENCE';

export interface ComRelogio {
  atualizadoEmCliente: string;
}

// O contrato comum de todas as estratégias.
export interface ConflictResolutionStrategy<T> {
  readonly nome: NomeEstrategia;
  resolve(servidor: T, recebido: T): T;
}

const recebidoMaisRecente = (s: ComRelogio, r: ComRelogio) =>
  Date.parse(r.atualizadoEmCliente) >= Date.parse(s.atualizadoEmCliente);

/** Last-write-wins: vence a edição com o horário mais recente no aparelho. */
export class LastWriteWinsStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
  readonly nome = 'LWW' as const;
  resolve(servidor: T, recebido: T): T {
    return recebidoMaisRecente(servidor, recebido) ? recebido : servidor; // o horário mais novo vence
  }
}

/**
 * Mescla: campos simples por last-write-wins e listas por união — uma alergia
 * registrada por qualquer equipe nunca se perde.
 */
export class MergeStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
  readonly nome = 'MESCLA' as const;
  private readonly lww = new LastWriteWinsStrategy<T>();

  constructor(private readonly listas: readonly (keyof T)[]) {}

  resolve(servidor: T, recebido: T): T {
    const out = { ...this.lww.resolve(servidor, recebido) }; // 1) campos simples: o mais novo vence
    for (const campo of this.listas) { // 2) listas (alergias, comorbidades): junta as duas, sem repetir
      out[campo] = uniaoTermos(servidor[campo] as string[], recebido[campo] as string[]) as T[keyof T];
    }
    return out;
  }
}

/** O registro do servidor prevalece (atendimento registrado é imutável). */
export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
  readonly nome = 'SERVIDOR_VENCE' as const;
  resolve(servidor: T): T {
    return servidor; // ignora o que chegou: fica o que já está na central
  }
}
