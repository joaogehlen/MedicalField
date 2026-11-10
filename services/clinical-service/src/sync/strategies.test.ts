import { describe, expect, it } from 'vitest';
import { LastWriteWinsStrategy, MergeStrategy, ServerWinsStrategy } from './strategies';

interface P {
  atualizadoEmCliente: string;
  tipoSanguineo: string | null;
  alergias: string[];
}

const servidor: P = { atualizadoEmCliente: '2026-11-20T10:00:00Z', tipoSanguineo: 'O+', alergias: ['Dipirona'] };

describe('Strategies de conflito', () => {
  it('LWW: vence a edição mais recente', () => {
    const novo = { ...servidor, atualizadoEmCliente: '2026-11-20T11:00:00Z', tipoSanguineo: 'A+' };
    const lww = new LastWriteWinsStrategy<P>();
    expect(lww.resolve(servidor, novo)).toBe(novo);
    expect(lww.resolve(novo, servidor)).toBe(novo);
  });

  it('Mescla: une as alergias das duas equipes', () => {
    const recebido: P = { atualizadoEmCliente: '2026-11-20T09:00:00Z', tipoSanguineo: 'A+', alergias: ['dipirona', 'Látex'] };
    const r = new MergeStrategy<P>(['alergias']).resolve(servidor, recebido);
    expect(r.alergias).toEqual(['Dipirona', 'Látex']);
    expect(r.tipoSanguineo).toBe('O+'); // edição recebida era mais antiga
  });

  it('Servidor vence: atendimento registrado não muda', () => {
    expect(new ServerWinsStrategy<P>().resolve(servidor)).toBe(servidor);
  });
});
