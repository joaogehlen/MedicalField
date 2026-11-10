/**
 * Teste de ponta a ponta contra o clinical-service em execução (banco real).
 * Roda só com E2E_URL e JWT_PRIVATE_KEY_PATH definidos.
 */
import { randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const URL_BASE = process.env.E2E_URL;
const CHAVE = process.env.JWT_PRIVATE_KEY_PATH;
const MEDICA = '7a1f0000-0000-4000-8000-000000000002';
const DIPIRONA = '5e3d0000-0000-4000-8000-000000000001';
const ONDANSETRONA = '5e3d0000-0000-4000-8000-000000000004';

function token() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ sub: MEDICA, papel: 'MEDICO', nome: 'Teste', iss: 'medicalfield-identity', iat: agora, exp: agora + 300 })}`;
  return `${corpo}.${sign('RSA-SHA256', Buffer.from(corpo), readFileSync(CHAVE!, 'utf8')).toString('base64url')}`;
}

async function api(metodo: string, rota: string, corpo?: unknown, chave?: string) {
  const r = await fetch(`${URL_BASE}${rota}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(chave ? { 'Idempotency-Key': chave } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, replay: r.headers.get('idempotent-replayed'), body: (await r.json()) as any };
}

const meta = (quando: string) => ({ atualizadoEmCliente: quando, registradoPor: MEDICA, dispositivoId: 'e2e' });

describe.skipIf(!URL_BASE || !CHAVE)('clinical-service (e2e)', () => {
  const pessoaId = randomUUID();
  const prontuarioId = randomUUID();
  const atendimentoId = randomUUID();
  const atendimento = (medicamentoId: string) => ({
    id: atendimentoId,
    pessoaId,
    prontuarioId,
    dataHora: '2026-11-20T13:35:00Z',
    local: 'Teste e2e',
    queixaPrincipal: 'Queda de altura',
    triagem: { protocolo: 'START', classificacao: 'VERMELHO' },
    glasgow: { ocular: 3, verbal: 4, motora: 5, total: 12 },
    sinaisVitais: { fc: 120, spo2: 91 },
    medicamentos: [{ id: randomUUID(), medicamentoId, dose: 4, via: 'IV', horario: '2026-11-20T13:40:00Z' }],
    profissionalNome: 'Dra. Teste',
    ...meta('2026-11-20T13:50:00Z'),
  });

  it('prontuário antes da pessoa → 409', async () => {
    const r = await api('POST', '/prontuario', { id: prontuarioId, pessoaId, alergias: [], ...meta('2026-11-20T13:41:00Z') });
    expect(r.status).toBe(409);
  });

  it('pessoa: reenvio com a mesma Idempotency-Key não duplica', async () => {
    const chave = randomUUID();
    const corpo = { id: pessoaId, nome: 'Vítima E2E', ...meta('2026-11-20T13:40:00Z') };
    expect((await api('POST', '/pessoa', corpo, chave)).status).toBe(201);
    const b = await api('POST', '/pessoa', corpo, chave);
    expect(b.replay).toBe('true');
  });

  it('prontuário: edições concorrentes unem as alergias (Strategy de mescla)', async () => {
    const base = { id: prontuarioId, pessoaId, alergias: ['Dipirona'], comorbidades: [], ...meta('2026-11-20T13:41:00Z') };
    expect((await api('POST', '/prontuario', base)).status).toBe(201);
    await api('POST', '/prontuario', { ...base, baseVersion: 1, tipoSanguineo: 'O+', ...meta('2026-11-20T13:45:00Z') });
    const b = await api('POST', '/prontuario', { ...base, baseVersion: 1, alergias: ['Látex'], ...meta('2026-11-20T13:44:00Z') });
    expect(b.body.resultado).toBe('MESCLADO');
    expect(b.body.registro.alergias).toEqual(['Dipirona', 'Látex']);
    expect(b.body.registro.tipoSanguineo).toBe('O+');
  });

  it('bloqueia dipirona para alérgico (regra clínica no servidor)', async () => {
    const r = await api('POST', '/atendimento', atendimento(DIPIRONA));
    expect(r.status).toBe(422);
    expect(r.body.codigo).toBe('REGRA_CLINICA');
  });

  it('registra atendimento e o mantém imutável', async () => {
    expect((await api('POST', '/atendimento', atendimento(ONDANSETRONA))).status).toBe(201);
    const outro = { ...atendimento(ONDANSETRONA), queixaPrincipal: 'Editado', ...meta('2026-11-20T15:00:00Z') };
    const r = await api('POST', '/atendimento', outro);
    expect(r.body.resultado).toBe('MESCLADO');
    expect(r.body.registro.queixaPrincipal).toBe('Queda de altura');
  });

  it('GET /atendimento/{pessoaId} e pull por cursor', async () => {
    expect((await api('GET', `/atendimento/${pessoaId}`)).body).toHaveLength(1);
    const pull = await api('GET', '/sync/pull?cursor=0');
    expect(pull.body.atendimentos.some((a: any) => a.id === atendimentoId)).toBe(true);
    expect((await api('GET', `/sync/pull?cursor=${pull.body.proximoCursor}`)).body.atendimentos).toHaveLength(0);
  });
});
