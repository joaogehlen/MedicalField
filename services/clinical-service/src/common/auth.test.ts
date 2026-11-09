import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://teste';
const { verificarJwt } = await import('./auth');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function token(claims: object, alg = 'RS256') {
  const corpo = `${b64({ alg, typ: 'JWT' })}.${b64(claims)}`;
  return `${corpo}.${sign('RSA-SHA256', Buffer.from(corpo), privateKey).toString('base64url')}`;
}

const claims = { sub: 'p1', nome: 'Dra. Ana', papel: 'MEDICO', iss: 'medicalfield-identity', exp: Math.floor(Date.now() / 1000) + 60 };

describe('verificarJwt', () => {
  it('aceita token válido', () => {
    expect(verificarJwt(token(claims), publicKey, 'medicalfield-identity')?.sub).toBe('p1');
  });
  it('rejeita expirado, emissor errado, algoritmo errado e assinatura adulterada', () => {
    expect(verificarJwt(token({ ...claims, exp: 1 }), publicKey, 'medicalfield-identity')).toBeNull();
    expect(verificarJwt(token({ ...claims, iss: 'outro' }), publicKey, 'medicalfield-identity')).toBeNull();
    expect(verificarJwt(token(claims, 'none'), publicKey, 'medicalfield-identity')).toBeNull();
    const t = token(claims);
    expect(verificarJwt(`${t.slice(0, -3)}abc`, publicKey, 'medicalfield-identity')).toBeNull();
  });
});
