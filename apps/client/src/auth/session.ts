/**
 * Sessão do profissional. Login online (identity-service) guarda uma credencial
 * derivada (PBKDF2) no banco local, permitindo entrar de novo sem rede.
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, randomBytes } from '@noble/hashes/utils';
import type { LoginRequest, LoginResponse, Profissional } from '@medicalfield/shared';
import { db } from '../data/db';

export interface Sessao {
  profissional: Profissional;
  accessToken: string | null;
  refreshToken: string | null;
  /** epoch ms em que o access token expira */
  expiraEm: number | null;
  modo: 'ONLINE' | 'OFFLINE';
}

const CHAVE = 'mf.sessao';
const ITERACOES = 150_000;

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
let atual: Sessao | null = carregar();

function carregar(): Sessao | null {
  try {
    const s = localStorage.getItem(CHAVE);
    return s ? (JSON.parse(s) as Sessao) : null;
  } catch {
    return null;
  }
}

function salvar(s: Sessao | null) {
  atual = s;
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: sessão só em memória */
  }
  ouvintes.forEach((o) => o());
}

export const sessao = {
  get: () => atual,
  subscribe(o: Ouvinte) {
    ouvintes.add(o);
    return () => ouvintes.delete(o);
  },
  definir: salvar,
  /** Atualiza tokens após login online ou refresh. */
  aplicarLogin(r: LoginResponse) {
    salvar({
      profissional: r.profissional,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiraEm: Date.now() + r.expiresIn * 1000,
      modo: 'ONLINE',
    });
  },
};

export function chaveCredencial(req: Pick<LoginRequest, 'tipoRegistro' | 'numeroRegistro' | 'uf'>) {
  const uf = req.tipoRegistro === 'SOCORRISTA' ? '' : (req.uf ?? '').toUpperCase();
  return `${req.tipoRegistro}:${req.numeroRegistro.trim()}:${uf}`;
}

async function derivar(senha: string, salt: string): Promise<string> {
  return bytesToHex(await pbkdf2Async(sha256, senha, salt, { c: ITERACOES, dkLen: 32 }));
}

/** Guarda a credencial derivada para permitir login offline neste aparelho. */
export async function guardarCredencial(req: LoginRequest, r: LoginResponse) {
  const salt = bytesToHex(randomBytes(16));
  await db.credenciais.put({
    chave: chaveCredencial(req),
    salt,
    hash: await derivar(req.senha, salt),
    profissional: r.profissional,
    refreshToken: r.refreshToken,
    atualizadoEm: new Date().toISOString(),
  });
}

export async function atualizarRefreshDaCredencial(profissionalId: string, refreshToken: string) {
  const cred = await db.credenciais.filter((c) => c.profissional.id === profissionalId).first();
  if (cred) await db.credenciais.put({ ...cred, refreshToken });
}

export type ResultadoOffline = { ok: true; profissional: Profissional; refreshToken: string | null } | { ok: false; motivo: string };

export async function validarOffline(req: LoginRequest): Promise<ResultadoOffline> {
  const cred = await db.credenciais.get(chaveCredencial(req));
  if (!cred) {
    return { ok: false, motivo: 'Este aparelho ainda não tem seu acesso. Entre uma vez com conexão para liberar o login offline.' };
  }
  if ((await derivar(req.senha, cred.salt)) !== cred.hash) {
    return { ok: false, motivo: 'Registro profissional ou senha incorretos.' };
  }
  return { ok: true, profissional: cred.profissional, refreshToken: cred.refreshToken };
}
