/**
 * Padrão Strategy: algoritmos de resolução de conflito, aplicados quando chega uma
 * edição feita sobre uma versão antiga do registro (baseVersion < version).
 */
import { uniaoTermos } from '@medicalfield/shared';

export type NomeEstrategia = 'LWW' | 'MESCLA' | 'SERVIDOR_VENCE';

export interface ComRelogio {
  atualizadoEmCliente: string;
}

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
    return recebidoMaisRecente(servidor, recebido) ? recebido : servidor;
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
    const out = { ...this.lww.resolve(servidor, recebido) };
    for (const campo of this.listas) {
      out[campo] = uniaoTermos(servidor[campo] as string[], recebido[campo] as string[]) as T[keyof T];
    }
    return out;
  }
}

/** O registro do servidor prevalece (atendimento registrado é imutável). */
export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
  readonly nome = 'SERVIDOR_VENCE' as const;
  resolve(servidor: T): T {
    return servidor;
  }
}
