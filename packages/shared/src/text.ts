/** Caixa alta, sem acentos e sem espaços nas pontas — para comparar termos clínicos. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

/** Mantém só os dígitos de um CPF. */
export function somenteDigitos(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function formatarCpf(cpf: string | null | undefined): string {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return cpf ?? '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Une listas de termos sem duplicar (comparação sem acento/caixa), preservando a grafia original. */
export function uniaoTermos(...listas: (readonly string[] | null | undefined)[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const lista of listas) {
    for (const termo of lista ?? []) {
      const chave = normalizarTexto(termo);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(termo.trim());
    }
  }
  return out;
}
