import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AtendimentoResumo, Page } from '@medicalfield/shared';
import { useApi } from '../api';
import { fmtDataHora } from '../format';
import { Carregando, Erro, SeloOffline, TagTriagem } from '../ui';

export function Atendimentos() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const { dados, erro } = useApi<Page<AtendimentoResumo>>(`/atendimento?busca=${encodeURIComponent(busca)}`);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h3 mb-0">Atendimentos</h1>
          {dados && <p className="text-secondary mb-0">{dados.total} registrado{dados.total === 1 ? '' : 's'} na central</p>}
        </div>
        <div className="input-group" style={{ maxWidth: 360 }}>
          <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
          <input type="search" className="form-control" placeholder="Paciente, queixa ou local" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
      </div>
      {erro && <Erro mensagem={erro} />}
      {!dados ? <Carregando /> : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>Data e hora</th><th>Paciente</th><th>Queixa</th><th>Classificação</th><th>Profissional</th><th /></tr></thead>
              <tbody>
                {dados.itens.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">Nenhum atendimento encontrado.</td></tr>}
                {dados.itens.map((a) => (
                  <tr key={a.id} onClick={() => navegar(`/atendimentos/${a.id}`)}>
                    <td className="font-monospace small text-nowrap">{fmtDataHora(a.dataHora)}</td>
                    <td className="fw-bold">{a.pessoaNome}</td>
                    <td>{a.queixaPrincipal}<div className="small text-secondary">{a.local}</div></td>
                    <td><TagTriagem triagem={a.triagem} /></td>
                    <td className="small">{a.profissionalNome}</td>
                    <td>{a.criadoOffline && <SeloOffline />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
