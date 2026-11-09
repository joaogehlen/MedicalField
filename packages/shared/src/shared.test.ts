import { describe, expect, it } from 'vitest';
import {
  alertasImpeditivos,
  atendimentoSchema,
  avaliarAdministracao,
  cpfValido,
  glasgowGravidade,
  pessoaSchema,
  uniaoTermos,
  type ContextoAdministracao,
  type Medicamento,
} from './index';

const dipirona: Medicamento = {
  id: '0192f000-0000-7000-8000-000000000001',
  nome: 'Dipirona Sódica',
  principioAtivo: 'Metamizol',
  apresentacao: 'Ampola 500 mg/mL 2 mL',
  unidade: 'mg',
  viasPermitidas: ['IV', 'IM'],
  doseMaximaDose: 1000,
  doseMaximaDiaria: 4000,
  intervaloMinimoHoras: 6,
  controlado: false,
  contraindicacoes: [],
  alergenos: ['DIPIRONA', 'PIRAZOLONAS'],
  ativo: true,
};

const ctx = (over: Partial<ContextoAdministracao> = {}): ContextoAdministracao => ({
  medicamento: dipirona,
  dose: 1000,
  via: 'IV',
  administradoEm: '2026-11-20T14:00:00Z',
  alergias: [],
  administracoesAnteriores: [],
  papel: 'MEDICO',
  ...over,
});

describe('ClinicalSafetyChain', () => {
  it('não gera alertas para uma administração dentro das regras', () => {
    expect(avaliarAdministracao(ctx())).toEqual([]);
  });

  it('bloqueia dose acima da máxima por administração (não ignorável)', () => {
    const alertas = avaliarAdministracao(ctx({ dose: 1500 }));
    expect(alertas.map((a) => a.codigo)).toContain('DOSE_MAXIMA');
    expect(alertasImpeditivos(alertas, [{ codigo: 'DOSE_MAXIMA', justificativa: 'ordem médica' }])).toHaveLength(1);
  });

  it('detecta alergia ignorando acento e caixa, e aceita justificativa', () => {
    const alertas = avaliarAdministracao(ctx({ alergias: ['dipírona'] }));
    expect(alertas[0]?.codigo).toBe('ALERGIA');
    expect(alertasImpeditivos(alertas)).toHaveLength(1);
    expect(alertasImpeditivos(alertas, [{ codigo: 'ALERGIA', justificativa: 'Reação prévia leve, regulação autorizou' }])).toHaveLength(0);
  });

  it('bloqueia via não permitida', () => {
    expect(avaliarAdministracao(ctx({ via: 'VO' })).map((a) => a.codigo)).toEqual(['VIA_NAO_PERMITIDA']);
  });

  it('soma as doses do atendimento contra a dose diária e avisa intervalo mínimo', () => {
    const anteriores = [
      { medicamentoId: dipirona.id, dose: 1000, administradoEm: '2026-11-20T09:00:00Z' },
      { medicamentoId: dipirona.id, dose: 1000, administradoEm: '2026-11-20T10:00:00Z' },
      { medicamentoId: dipirona.id, dose: 1000, administradoEm: '2026-11-20T11:00:00Z' },
      { medicamentoId: dipirona.id, dose: 1000, administradoEm: '2026-11-20T13:00:00Z' },
    ];
    const codigos = avaliarAdministracao(ctx({ administracoesAnteriores: anteriores })).map((a) => a.codigo);
    expect(codigos).toContain('DOSE_DIARIA');
    expect(codigos).toContain('INTERVALO_MINIMO');
  });

  it('impede socorrista de registrar medicamento controlado', () => {
    const morfina = { ...dipirona, id: '0192f000-0000-7000-8000-000000000002', nome: 'Morfina', controlado: true };
    const alertas = avaliarAdministracao(ctx({ medicamento: morfina, papel: 'SOCORRISTA', dose: 5 }));
    expect(alertas.map((a) => a.codigo)).toEqual(['CONTROLADO']);
  });
});

describe('schemas', () => {
  const meta = {
    atualizadoEmCliente: '2026-11-20T13:40:00Z',
    registradoPor: '0192f3c4-0000-7000-8000-000000000001',
    dispositivoId: 'dev-1',
  };

  it('exige características para vítima não identificada', () => {
    const r = pessoaSchema.safeParse({ id: '0192f5a1-0000-7000-8000-000000000001', nome: 'Desconhecido', identificada: false, ...meta });
    expect(r.success).toBe(false);
  });

  it('valida CPF', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });

  it('rejeita total de Glasgow inconsistente e classificação fora do protocolo', () => {
    const base = {
      id: '0192f5aa-0000-7000-8000-000000000001',
      pessoaId: '0192f5a1-0000-7000-8000-000000000001',
      prontuarioId: '0192f5a3-0000-7000-8000-000000000001',
      status: 'RASCUNHO',
      iniciadoEm: '2026-11-20T13:35:00Z',
      local: { descricao: 'BR-386, km 350' },
      queixaPrincipal: 'Colisão moto x carro',
      ...meta,
    };
    const ruim = atendimentoSchema.safeParse({
      ...base,
      triagem: { protocolo: 'START', classificacao: 'LARANJA' },
      glasgow: { ocular: 4, verbal: 4, motora: 6, total: 15 },
    });
    expect(ruim.success).toBe(false);
    const campos = ruim.success ? [] : ruim.error.issues.map((i) => i.path.join('.'));
    expect(campos).toEqual(expect.arrayContaining(['triagem.classificacao', 'glasgow.total']));

    const bom = atendimentoSchema.safeParse({
      ...base,
      triagem: { protocolo: 'MANCHESTER', classificacao: 'LARANJA' },
      glasgow: { ocular: 4, verbal: 4, motora: 6, total: 14 },
    });
    expect(bom.success).toBe(true);
  });

  it('une termos sem duplicar por acento/caixa', () => {
    expect(uniaoTermos(['Dipirona', 'Látex'], ['DIPIRONA', 'latex', 'Penicilina'])).toEqual(['Dipirona', 'Látex', 'Penicilina']);
    expect(glasgowGravidade(8)).toBe('GRAVE');
  });
});
