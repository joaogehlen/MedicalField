import { describe, expect, it } from 'vitest';
import { AppendOnlyUnionStrategy, FieldMergeStrategy, LastWriteWinsStrategy, ServerWinsStrategy } from './strategies';

interface P {
  atualizadoEmCliente: string;
  tipoSanguineo: string | null;
  observacoes: string | null;
  alergias: string[];
}

const servidor: P = { atualizadoEmCliente: '2026-11-20T10:00:00Z', tipoSanguineo: 'O+', observacoes: 'Marcapasso', alergias: ['Dipirona'] };

describe('FieldMergeStrategy', () => {
  const merge = new FieldMergeStrategy<P>(['tipoSanguineo', 'observacoes'], ['alergias']);

  it('une alergias das duas equipes e não deixa valor vazio apagar preenchido', () => {
    const recebido: P = { atualizadoEmCliente: '2026-11-20T11:00:00Z', tipoSanguineo: null, observacoes: 'Usa anticoagulante', alergias: ['dipirona', 'Látex'] };
    expect(merge.resolve(servidor, recebido)).toEqual({
      atualizadoEmCliente: '2026-11-20T11:00:00Z',
      tipoSanguineo: 'O+',
      observacoes: 'Usa anticoagulante',
      alergias: ['Dipirona', 'Látex'],
    });
  });

  it('mantém o valor do servidor quando a edição recebida é mais antiga', () => {
    const antigo: P = { atualizadoEmCliente: '2026-11-20T09:00:00Z', tipoSanguineo: 'A+', observacoes: null, alergias: [] };
    const r = merge.resolve(servidor, antigo);
    expect(r.tipoSanguineo).toBe('O+');
    expect(r.atualizadoEmCliente).toBe(servidor.atualizadoEmCliente);
  });
});

describe('LastWriteWins / ServerWins / AppendOnlyUnion', () => {
  it('LWW escolhe o carimbo mais recente', () => {
    const lww = new LastWriteWinsStrategy<P>();
    const novo = { ...servidor, atualizadoEmCliente: '2026-11-20T12:00:00Z', observacoes: 'novo' };
    expect(lww.resolve(servidor, novo)).toBe(novo);
    expect(lww.resolve(novo, servidor)).toBe(novo);
  });

  it('ServerWins ignora o recebido', () => {
    expect(new ServerWinsStrategy<P>().resolve(servidor, { ...servidor, observacoes: 'x' })).toBe(servidor);
  });

  it('união por id preserva itens dos dois lados sem duplicar', () => {
    const u = new AppendOnlyUnionStrategy<{ id: string; v: number }>();
    expect(u.resolve([{ id: 'a', v: 1 }, { id: 'b', v: 2 }], [{ id: 'b', v: 99 }, { id: 'c', v: 3 }])).toEqual([
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'c', v: 3 },
    ]);
  });
});
