import type { ZodTypeAny, z } from 'zod';

/** Valida o corpo com um schema compartilhado; ZodError vira 422 no ProblemFilter. */
export function validar<S extends ZodTypeAny>(schema: S, dados: unknown): z.output<S> {
  return schema.parse(dados);
}
