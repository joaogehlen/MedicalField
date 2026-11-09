import { readFileSync } from 'node:fs';

function obrigatoria(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Variável de ambiente ${nome} não definida`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '127.0.0.1',
  databaseUrl: obrigatoria('DATABASE_URL'),
  jwtIssuer: process.env.JWT_ISSUER ?? 'medicalfield-identity',
  jwtPublicKey: () => readFileSync(obrigatoria('JWT_PUBLIC_KEY_PATH'), 'utf8'),
  seedDemo: (process.env.SEED_DEMO ?? 'true') === 'true',
};
