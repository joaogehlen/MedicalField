import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import type { Papel, TokenClaims } from '@medicalfield/shared';
import { config } from '../config';
import { ApiError } from './errors';
import type { MfRequest, UsuarioToken } from './request';

const PAPEIS_KEY = 'mf:papeis';

/** Restringe a rota aos papéis informados. */
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS_KEY, papeis);

/** Injeta o profissional autenticado no handler. */
export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioToken => {
  return ctx.switchToHttp().getRequest<MfRequest>().usuario!;
});

const b64url = (s: string) => Buffer.from(s, 'base64url');

/** Valida um JWT RS256 emitido pelo identity-service usando só a chave pública. */
export function verificarJwt(token: string, chave: KeyObject, issuer: string, agora = Date.now()): TokenClaims | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [h, p, s] = partes;
  try {
    const header = JSON.parse(b64url(h).toString('utf8'));
    if (header.alg !== 'RS256') return null;
    if (!verify('RSA-SHA256', Buffer.from(`${h}.${p}`), chave, b64url(s))) return null;
    const claims = JSON.parse(b64url(p).toString('utf8')) as TokenClaims;
    if (claims.iss !== issuer || typeof claims.exp !== 'number' || claims.exp * 1000 < agora) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Guard global: toda rota exige JWT válido (o login fica no identity-service).
 * A validação é local — não depende do identity-service estar no ar.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly chave = createPublicKey(config.jwtPublicKey());

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<MfRequest>();
    const header = req.headers.authorization ?? '';
    const claims = header.startsWith('Bearer ') ? verificarJwt(header.slice(7).trim(), this.chave, config.jwtIssuer) : null;
    if (!claims) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'NAO_AUTENTICADO', 'Não autenticado', 'Token ausente, inválido ou expirado.');
    }
    req.usuario = { id: claims.sub, nome: claims.nome, papel: claims.papel, registro: claims.registro };

    const papeis = this.reflector.getAllAndOverride<Papel[] | undefined>(PAPEIS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (papeis && !papeis.includes(claims.papel)) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'SEM_PERMISSAO', 'Sem permissão', 'Seu papel não tem acesso a este recurso.');
    }
    return true;
  }
}
