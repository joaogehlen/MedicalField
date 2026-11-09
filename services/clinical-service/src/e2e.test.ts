/**
 * Teste de ponta a ponta contra um clinical-service em execução (com banco real).
 * Roda só quando E2E_URL e JWT_PRIVATE_KEY_PATH estão definidos, ex.:
 *   E2E_URL=http://127.0.0.1:3001 JWT_PRIVATE_KEY_PATH=.runtime/keys/jwt-private.pem npm test
 */
import { randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const URL_BASE = process.env.E2E_URL;
const CHAVE = process.env.JWT_PRIVATE_KEY_PATH;
const MEDICA = '7a1f0000-0000-4000-8000-000000000002';
const SOCORRISTA = '7a1f0000-0000-4000-8000-000000000004';
const DIPIRONA = '5e3d0000-0000-4000-8000-000000000001';
const MORFINA = '5e3d0000-0000-4000-8000-000000000003';

function token(sub: string, papel: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    sub, papel, nome: 'Teste', registro: 'X', tipoRegistro: 'CRM', iss: 'medicalfield-identity', iat: agora, exp: agora + 300, jti: randomUUID(),
  })}`;
  return `${corpo}.${sign('RSA-SHA256', Buffer.from(corpo), readFileSync(CHAVE!, 'utf8')).toString('base64url')}`;
}

async function api(metodo: string, rota: string, corpo?: unknown, opts: { chave?: string; tok?: string } = {}) {
  const r = await fetch(`${URL_BASE}${rota}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${opts.tok ?? token(MEDICA, 'MEDICO')}`,
      'Content-Type': 'application/json',
      ...(opts.chave ? { 'Idempotency-Key': opts.chave } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, replay: r.headers.get('idempotent-replayed'), body: (await r.json()) as any };
}

const meta = (quando = new Date().toISOString()) => ({ atualizadoEmCliente: quando, registradoPor: MEDICA, dispositivoId: 'e2e' });

describe.skipIf(!URL_BASE || !CHAVE)('clinical-service (e2e)', () => {
  const pessoaId = randomUUID();
  const prontuarioId = randomUUID();
  const atendimentoId = randomUUID();
  const sinalId = randomUUID();

  const atendimento = (extra: object = {}) => ({
    id: atendimentoId,
    pessoaId,
    prontuarioId,
    status: 'RASCUNHO',
    iniciadoEm: '2026-11-20T13:35:00Z',
    local: { descricao: 'Teste e2e' },
    queixaPrincipal: 'Queda de altura',
    triagem: { protocolo: 'START', classificacao: 'VERMELHO' },
    glasgow: { ocular: 3, verbal: 4, motora: 5, total: 12 },
    sinaisVitais: [{ id: sinalId, aferidoEm: '2026-11-20T13:40:00Z', fc: 120, spo2: 91 }],
    medicamentos: [],
    ...meta('2026-11-20T13:50:00Z'),
    ...extra,
  });

  it('atendimento antes da pessoa → 409 DEPENDENCIA_AUSENTE', async () => {
    const r = await api('POST', '/atendimento', atendimento());
    expect(r.status).toBe(409);
    expect(r.body.codigo).toBe('DEPENDENCIA_AUSENTE');
  });

  it('cria pessoa; reenvio com a mesma Idempotency-Key devolve a mesma resposta', async () => {
    const corpo = { id: pessoaId, nome: 'Vítima E2E', identificada: false, caracteristicas: 'Homem, ~40 anos, tatuagem no braço', criadoOffline: true, ...meta() };
    const chave = randomUUID();
    const a = await api('POST', '/pessoa', corpo, { chave });
    expect(a.status).toBe(201);
    expect(a.body.resultado).toBe('CRIADO');
    const b = await api('POST', '/pessoa', corpo, { chave });
    expect(b.status).toBe(201);
    expect(b.replay).toBe('true');
    expect(b.body.registro.version).toBe(a.body.registro.version);
  });

  it('valida o corpo com os schemas compartilhados (422 com campos)', async () => {
    const r = await api('POST', '/atendimento', atendimento({ glasgow: { ocular: 3, verbal: 4, motora: 5, total: 15 } }));
    expect(r.status).toBe(422);
    expect(r.body.campos.map((c: any) => c.campo)).toContain('glasgow.total');
  });

  it('prontuário com edição concorrente: alergias são unidas (FieldMerge) e o conflito é registrado', async () => {
    const base = { id: prontuarioId, pessoaId, alergias: ['Dipirona'], comorbidades: [], medicamentosUsoContinuo: [], ...meta('2026-11-20T13:41:00Z') };
    const criado = await api('POST', '/prontuario', base, { chave: randomUUID() });
    expect(criado.status).toBe(201);
    // Equipe A atualiza sobre a versão 1.
    const a = await api('POST', '/prontuario', { ...base, baseVersion: 1, tipoSanguineo: 'O+', ...meta('2026-11-20T13:45:00Z') }, { chave: randomUUID() });
    expect(a.body.resultado).toBe('ATUALIZADO');
    // Equipe B, que também estava na versão 1, registra outra alergia.
    const b = await api('POST', '/prontuario', { ...base, baseVersion: 1, alergias: ['Látex'], ...meta('2026-11-20T13:44:00Z') }, { chave: randomUUID() });
    expect(b.body.resultado).toBe('MESCLADO');
    expect(b.body.registro.alergias).toEqual(['Dipirona', 'Látex']);
    expect(b.body.registro.tipoSanguineo).toBe('O+');
  });

  it('bloqueia dipirona para paciente alérgico (ClinicalSafetyChain no servidor)', async () => {
    const adm = { id: randomUUID(), medicamentoId: DIPIRONA, dose: 1000, unidade: 'mg', via: 'IV', administradoEm: '2026-11-20T13:46:00Z', administradoPor: MEDICA, alertasIgnorados: [] };
    const r = await api('POST', '/atendimento', atendimento({ medicamentos: [adm] }));
    expect(r.status).toBe(422);
    expect(r.body.codigo).toBe('REGRA_CLINICA');
    expect(r.body.alertas[0].codigo).toBe('ALERGIA');
  });

  it('impede socorrista de registrar medicamento controlado', async () => {
    const adm = { id: randomUUID(), medicamentoId: MORFINA, dose: 4, unidade: 'mg', via: 'IV', administradoEm: '2026-11-20T13:46:00Z', administradoPor: SOCORRISTA, alertasIgnorados: [] };
    const r = await api('POST', '/atendimento', atendimento({ medicamentos: [adm], registradoPor: SOCORRISTA }), { tok: token(SOCORRISTA, 'SOCORRISTA') });
    expect(r.status).toBe(422);
    expect(r.body.alertas[0].codigo).toBe('CONTROLADO');
  });

  it('cria atendimento; finalizado é imutável e sinais de outro dispositivo são unidos', async () => {
    const criado = await api('POST', '/atendimento', atendimento(), { chave: randomUUID() });
    expect(criado.status).toBe(201);
    const fin = await api('POST', '/atendimento', atendimento({ status: 'FINALIZADO', finalizadoEm: '2026-11-20T14:20:00Z', baseVersion: 1 }), { chave: randomUUID() });
    expect(fin.body.resultado).toBe('ATUALIZADO');
    const sinalNovo = { id: randomUUID(), aferidoEm: '2026-11-20T14:00:00Z', fc: 110 };
    const tardio = await api(
      'POST',
      '/atendimento',
      atendimento({ queixaPrincipal: 'Edição tardia', baseVersion: 1, sinaisVitais: [sinalNovo] }),
      { chave: randomUUID() },
    );
    expect(tardio.body.resultado).toBe('MESCLADO');
    expect(tardio.body.registro.status).toBe('FINALIZADO');
    expect(tardio.body.registro.queixaPrincipal).toBe('Queda de altura');
    expect(tardio.body.registro.sinaisVitais).toHaveLength(2);
  });

  it('pull por cursor devolve só o que mudou depois do cursor', async () => {
    const inicio = await api('GET', '/sync/pull?cursor=0&limite=1000');
    const cursor = inicio.body.proximoCursor;
    expect((await api('GET', `/sync/pull?cursor=${cursor}`)).body.atendimentos).toHaveLength(0);
    await api('POST', '/atendimento/' + atendimentoId + '/adendo', { id: randomUUID(), texto: 'Correção: paciente usa óculos.' });
    const depois = await api('GET', `/sync/pull?cursor=${cursor}`);
    expect(depois.body.atendimentos.map((a: any) => a.id)).toEqual([atendimentoId]);
    expect(depois.body.atendimentos[0].adendos).toHaveLength(1);
  });

  it('conflitos ficam visíveis só para ADMIN', async () => {
    expect((await api('GET', '/sync/conflito')).status).toBe(403);
    const r = await api('GET', '/sync/conflito', undefined, { tok: token(MEDICA, 'ADMIN') });
    expect(r.body.total).toBeGreaterThanOrEqual(2);
  });
});
