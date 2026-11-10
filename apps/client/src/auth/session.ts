/** Sessão do profissional, guardada no aparelho (continua válida mesmo sem rede). */
import { registroProfissional, type LoginResponse, type Profissional } from '@medicalfield/shared';

export interface Sessao {
  profissional: Profissional;
  token: string;
  expiraEm: number;
}

const CHAVE = 'mf.sessao';
const ouvintes = new Set<() => void>();
let atual: Sessao | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Sessao | null;
  } catch {
    return null;
  }
})();

function salvar(s: Sessao | null) {
  atual = s;
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
  ouvintes.forEach((o) => o());
}

export const sessao = {
  get: () => atual,
  subscribe(o: () => void) {
    ouvintes.add(o);
    return () => ouvintes.delete(o);
  },
  entrar: (r: LoginResponse) => salvar({ profissional: r.profissional, token: r.accessToken, expiraEm: Date.now() + r.expiresIn * 1000 }),
  sair: () => salvar(null),
  /** "Dra. Ana Souza · CRM 12345/RS" — como sai na ficha. */
  assinatura: () => (atual ? `${atual.profissional.nome} · ${registroProfissional(atual.profissional)}` : ''),
};
