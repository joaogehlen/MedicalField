/**
 * Padrão Strategy: algoritmos de resolução de conflito usados quando chega uma escrita
 * feita sobre uma versão antiga do registro (baseVersion < version no servidor).
 */
import { uniaoTermos } from '@medicalfield/shared';

export type NomeEstrategia = 'LWW' | 'FIELD_MERGE' | 'UNION' | 'SERVER_WINS';

export interface ComRelogio {
  atualizadoEmCliente: string;
}

export interface ConflictResolutionStrategy<T> {
  readonly nome: NomeEstrategia;
  resolve(servidor: T, recebido: T): T;
}

const maisRecente = (a: ComRelogio, b: ComRelogio) => Date.parse(b.atualizadoEmCliente) >= Date.parse(a.atualizadoEmCliente);
const vazio = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Vence o registro com o carimbo de data/hora clínico mais recente. */
export class LastWriteWinsStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
  readonly nome = 'LWW' as const;
  resolve(servidor: T, recebido: T): T {
    return maisRecente(servidor, recebido) ? recebido : servidor;
  }
}

/** Cadastros de apoio só mudam no servidor. */
export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
  readonly nome = 'SERVER_WINS' as const;
  resolve(servidor: T): T {
    return servidor;
  }
}

/**
 * Mescla campo a campo: um valor vazio nunca apaga um preenchido; quando os dois lados
 * têm valores diferentes, vence o mais recente. Campos de lista são unidos (uma alergia
 * registrada por qualquer equipe nunca se perde).
 */
export class FieldMergeStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
  readonly nome = 'FIELD_MERGE' as const;

  constructor(
    private readonly campos: readonly (keyof T)[],
    private readonly camposUniao: readonly (keyof T)[] = [],
  ) {}

  resolve(servidor: T, recebido: T): T {
    const recebidoVence = maisRecente(servidor, recebido);
    const out = { ...servidor };
    for (const c of this.campos) {
      const s = servidor[c];
      const r = recebido[c];
      if (vazio(r)) continue;
      if (vazio(s) || recebidoVence) out[c] = r;
    }
    for (const c of this.camposUniao) {
      out[c] = uniaoTermos(servidor[c] as string[], recebido[c] as string[]) as T[keyof T];
    }
    out.atualizadoEmCliente = recebidoVence ? recebido.atualizadoEmCliente : servidor.atualizadoEmCliente;
    return out;
  }
}

/** Itens append-only (sinais vitais, medicamentos): união por id; o servidor vence no mesmo id. */
export class AppendOnlyUnionStrategy<I extends { id: string }> implements ConflictResolutionStrategy<I[]> {
  readonly nome = 'UNION' as const;
  resolve(servidor: I[], recebido: I[]): I[] {
    const ids = new Set(servidor.map((i) => i.id));
    return [...servidor, ...recebido.filter((i) => !ids.has(i.id))];
  }
}
