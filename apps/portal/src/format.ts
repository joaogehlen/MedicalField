import { formatarCpf } from '@medicalfield/shared';

const dh = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const d = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const h = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const fmtDataHora = (iso?: string | null) => (iso ? dh.format(new Date(iso)).replace(', ', ' ') : '—');
export const fmtHora = (iso?: string | null) => (iso ? h.format(new Date(iso)) : '—');
export const fmtData = (iso?: string | null) => (iso ? d.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)) : '—');
export const fmtCpf = (c?: string | null) => (c ? formatarCpf(c) : '—');
export function idade(n?: string | null) {
  if (!n) return null;
  const a = new Date(`${n}T12:00:00`);
  const hoje = new Date();
  let anos = hoje.getFullYear() - a.getFullYear();
  if (hoje.getMonth() < a.getMonth() || (hoje.getMonth() === a.getMonth() && hoje.getDate() < a.getDate())) anos--;
  return `${anos} anos`;
}
