import { formatarCpf } from '@medicalfield/shared';

const dataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const fmtDataHora = (iso?: string | null) => (iso ? dataHora.format(new Date(iso)).replace(',', '') : '—');
export const fmtData = (iso?: string | null) => (iso ? data.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)) : '—');
export const fmtHora = (iso?: string | null) => (iso ? hora.format(new Date(iso)) : '—');
export const fmtCpf = (cpf?: string | null) => (cpf ? formatarCpf(cpf) : '—');

export function idade(nascimento?: string | null) {
  if (!nascimento) return null;
  const n = new Date(`${nascimento}T12:00:00`);
  const h = new Date();
  let anos = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) anos--;
  return `${anos} anos`;
}

export function relativo(iso?: string | null) {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return fmtDataHora(iso);
}

/** Valor para <input type="datetime-local"> no fuso do aparelho. */
export function paraInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
