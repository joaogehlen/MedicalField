import { formatarCpf } from '@medicalfield/shared';

const dataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dataCompleta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const fmtDataHora = (iso?: string | null) => (iso ? dataHora.format(new Date(iso)).replace(', ', ' ') : '—');
export const fmtHora = (iso?: string | null) => (iso ? hora.format(new Date(iso)) : '—');
export const fmtData = (iso?: string | null) => (iso ? dataCompleta.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)) : '—');
export const fmtCpf = (cpf?: string | null) => (cpf ? formatarCpf(cpf) : '—');

export function idade(nascimento?: string | null): string | null {
  if (!nascimento) return null;
  const n = new Date(`${nascimento}T12:00:00`);
  const h = new Date();
  let anos = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) anos--;
  return `${anos} anos`;
}

/** "há 3 min", "há 2 h" — para estados de sincronização. */
export function relativo(iso?: string | null): string {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return fmtDataHora(iso);
}

/** Valor para <input type="datetime-local"> no fuso do aparelho. */
export function paraInputLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const deInputLocal = (v: string) => new Date(v).toISOString();

/** Hora se for hoje; senão data e hora. */
export function fmtQuando(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? hora.format(d) : dataHora.format(d).replace(', ', ' ');
}
