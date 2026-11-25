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

// O CONTRATO
// Toda estratégia recebe as duas versões do registro (a que está no banco e a que acabou de chegar)
// e devolve a versão final. O "nome" vai para o histórico de conflitos (tabela sync_conflito).
export interface ConflictResolutionStrategy<T> {
  readonly nome: NomeEstrategia;
  resolve(servidor: T, recebido: T): T;
}

const recebidoMaisRecente = (s: ComRelogio, r: ComRelogio) =>
  Date.parse(r.atualizadoEmCliente) >= Date.parse(s.atualizadoEmCliente);

// ESTRATÉGIA 1 — LAST WRITE WINS (usada em Pessoa)
// Compara o horário em que cada aparelho fez a edição (atualizadoEmCliente).
// Fica a versão editada por último; a outra é descartada.
export class LastWriteWinsStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
  readonly nome = 'LWW' as const;
  resolve(servidor: T, recebido: T): T {
    return recebidoMaisRecente(servidor, recebido) ? recebido : servidor; // o horário mais novo vence
  }
}

// ESTRATÉGIA 2 — MESCLA (usada em Prontuário)
// Campos simples (tipo sanguíneo, observações): vence o mais recente, igual à estratégia 1.
// Listas (alergias, comorbidades): junta as duas versões. Se uma equipe anotou "Penicilina" e
// outra anotou "Látex", ficam as duas: perder uma alergia seria perigoso para o paciente.
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

// ESTRATÉGIA 3 — SERVIDOR VENCE (usada em Atendimento)
// Um atendimento já registrado na central é um documento: não pode ser trocado depois.
// Então o que chegou é ignorado e fica a versão que já estava no banco.
export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
  readonly nome = 'SERVIDOR_VENCE' as const;
  resolve(servidor: T): T {
    return servidor; // ignora o que chegou: fica o que já está na central
  }
}
