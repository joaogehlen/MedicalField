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
// uniaoTermos: junta duas listas sem repetir, ignorando maiúsculas e acentos ("dipirona" = "Dipirona").
import { uniaoTermos } from '@medicalfield/shared';

// Os nomes possíveis das estratégias. Vão gravados no histórico de conflitos.
export type NomeEstrategia = 'LWW' | 'MESCLA' | 'SERVIDOR_VENCE';

// Todo registro que tem o horário em que foi editado no aparelho.
export interface ComRelogio {
  atualizadoEmCliente: string;
}

// O CONTRATO
// Toda estratégia recebe as duas versões do registro (a que está no banco e a que acabou de chegar)
// e devolve a versão final. O "nome" vai para o histórico de conflitos (tabela sync_conflito).
export interface ConflictResolutionStrategy<T> {
  // O nome da estratégia (LWW, MESCLA ou SERVIDOR_VENCE).
  readonly nome: NomeEstrategia;
  // servidor = o que está no banco; recebido = o que o aparelho mandou; devolve quem fica.
  resolve(servidor: T, recebido: T): T;
}

// Função de apoio: true se a versão recebida foi editada depois (ou no mesmo horário) da do servidor.
const recebidoMaisRecente = (s: ComRelogio, r: ComRelogio) =>
  Date.parse(r.atualizadoEmCliente) >= Date.parse(s.atualizadoEmCliente);

// ESTRATÉGIA 1 — LAST WRITE WINS (usada em Pessoa)
// Compara o horário em que cada aparelho fez a edição (atualizadoEmCliente).
// Fica a versão editada por último; a outra é descartada.
export class LastWriteWinsStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
  // Nome gravado no histórico de conflitos.
  readonly nome = 'LWW' as const;
  resolve(servidor: T, recebido: T): T {
    // A recebida é mais nova? Fica ela. Senão, fica a do servidor.
    return recebidoMaisRecente(servidor, recebido) ? recebido : servidor;
  }
}

// ESTRATÉGIA 2 — MESCLA (usada em Prontuário)
// Campos simples (tipo sanguíneo, observações): vence o mais recente, igual à estratégia 1.
// Listas (alergias, comorbidades): junta as duas versões. Se uma equipe anotou "Penicilina" e
// outra anotou "Látex", ficam as duas: perder uma alergia seria perigoso para o paciente.
export class MergeStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
  // Nome gravado no histórico de conflitos.
  readonly nome = 'MESCLA' as const;
  // Usa a estratégia 1 por dentro, para decidir os campos simples.
  private readonly lww = new LastWriteWinsStrategy<T>();

  // Recebe quais campos são listas. No prontuário: ['alergias', 'comorbidades'].
  constructor(private readonly listas: readonly (keyof T)[]) {}

  resolve(servidor: T, recebido: T): T {
    // Passo 1: começa pela versão mais recente (decide os campos simples).
    const out = { ...this.lww.resolve(servidor, recebido) };
    // Passo 2: para cada campo que é lista...
    for (const campo of this.listas) {
      // ...troca pela união das duas versões (servidor + recebido), sem repetir.
      out[campo] = uniaoTermos(servidor[campo] as string[], recebido[campo] as string[]) as T[keyof T];
    }
    // Devolve o registro mesclado.
    return out;
  }
}

// ESTRATÉGIA 3 — SERVIDOR VENCE (usada em Atendimento)
// Um atendimento já registrado na central é um documento: não pode ser trocado depois.
// Então o que chegou é ignorado e fica a versão que já estava no banco.
export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
  // Nome gravado no histórico de conflitos.
  readonly nome = 'SERVIDOR_VENCE' as const;
  // Só precisa da versão do servidor: o que chegou nem é olhado.
  resolve(servidor: T): T {
    // Devolve o que já está na central.
    return servidor;
  }
}
