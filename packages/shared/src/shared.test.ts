import { describe, expect, it } from 'vitest';
import { atendimentoSchema, avaliarAdministracao, cpfValido, uniaoTermos, type Medicamento } from './index';

const dipirona: Medicamento = {
  id: '5e3d0000-0000-4000-8000-000000000001',
  nome: 'Dipirona',
  apresentacao: 'Ampola 500 mg/mL',
  unidade: 'mg',
  viasPermitidas: ['IV', 'IM'],
  doseMaxima: 1000,
  alergenos: ['METAMIZOL', 'PIRAZOLONAS'],
  ativo: true,
};

describe('regras de segurança clínica (Chain of Responsibility)', () => {
  it('libera administração correta', () => {
    expect(avaliarAdministracao({ medicamento: dipirona, dose: 1000, via: 'IV', alergias: [] })).toEqual([]);
  });

  it('bloqueia via, dose e alergia (ignorando acento e caixa)', () => {
    const alertas = avaliarAdministracao({ medicamento: dipirona, dose: 2000, via: 'VO', alergias: ['dipírona'] });
    expect(alertas).toHaveLength(3);
    expect(alertas[2]).toContain('alérgico');
  });
});

describe('validações', () => {
  const base = {
    id: '0192f5aa-0000-7000-8000-000000000001',
    pessoaId: '0192f5a1-0000-7000-8000-000000000001',
    prontuarioId: '0192f5a3-0000-7000-8000-000000000001',
    dataHora: '2026-11-20T13:35:00Z',
    local: 'BR-386, km 350',
    queixaPrincipal: 'Colisão moto × carro',
    sinaisVitais: { fc: 102 },
    profissionalNome: 'Dra. Ana Souza · CRM 12345/RS',
    atualizadoEmCliente: '2026-11-20T13:40:00Z',
    registradoPor: '7a1f0000-0000-4000-8000-000000000002',
    dispositivoId: 'dev-1',
  };

  it('rejeita Glasgow inconsistente e cor fora do protocolo', () => {
    const r = atendimentoSchema.safeParse({
      ...base,
      triagem: { protocolo: 'START', classificacao: 'LARANJA' },
      glasgow: { ocular: 4, verbal: 4, motora: 6, total: 15 },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join('.'))).toEqual(expect.arrayContaining(['triagem.classificacao', 'glasgow.total']));
  });

  it('aceita atendimento válido', () => {
    const r = atendimentoSchema.safeParse({
      ...base,
      triagem: { protocolo: 'MANCHESTER', classificacao: 'LARANJA' },
      glasgow: { ocular: 4, verbal: 4, motora: 6, total: 14 },
    });
    expect(r.success).toBe(true);
  });

  it('valida CPF e une termos sem duplicar', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(uniaoTermos(['Dipirona'], ['DIPIRONA', 'Látex'])).toEqual(['Dipirona', 'Látex']);
  });
});
