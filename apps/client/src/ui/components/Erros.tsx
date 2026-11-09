import { AlertTriangle } from 'lucide-react';
import { ZodError } from 'zod';

/** Converte erros de validação em mensagens por campo. */
export function errosPorCampo(e: unknown): Record<string, string> {
  if (!(e instanceof ZodError)) return {};
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = i.path.join('.') || '_';
    out[k] ??= i.message;
  }
  return out;
}

export function ResumoErros({ erros }: { erros: Record<string, string> }) {
  const lista = Object.values(erros);
  if (lista.length === 0) return null;
  return (
    <div className="alerta alerta-erro" role="alert">
      <AlertTriangle aria-hidden />
      <div>
        <strong>Revise antes de salvar</strong>
        <ul className="lista-erros">
          {lista.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
