/** Caixa alta e sem acentos — para comparar termos clínicos. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

export function somenteDigitos(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function formatarCpf(cpf: string | null | undefined): string {
  const d = somenteDigitos(cpf);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (cpf ?? '');
}

/** Une listas de termos sem duplicar (ignora acento e caixa). */
export function uniaoTermos(...listas: (readonly string[] | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const termo of listas.flatMap((l) => l ?? [])) {
    const chave = normalizarTexto(termo);
    if (chave && !vistos.has(chave)) {
      vistos.add(chave);
      out.push(termo.trim());
    }
  }
  return out;
}
