import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Page, ProntuarioDetalhe, ProntuarioResumo } from '@medicalfield/shared';
import { useApi } from '../api';
import { fmtCpf, fmtData, fmtDataHora, idade } from '../format';
import { Carregando, Erro, TagTriagem } from '../ui';

export function Prontuarios() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const { dados, erro } = useApi<Page<ProntuarioResumo>>(`/prontuario?busca=${encodeURIComponent(busca)}`);
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Prontuários</h1>
        <div className="input-group" style={{ maxWidth: 360 }}>
          <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
          <input type="search" className="form-control" placeholder="Nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
      </div>
      {erro && <Erro mensagem={erro} />}
      {!dados ? <Carregando /> : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>Paciente</th><th>CPF</th><th>Tipo sanguíneo</th><th>Alergias</th><th className="text-end">Atendimentos</th></tr></thead>
              <tbody>
                {dados.itens.length === 0 && <tr><td colSpan={5} className="text-center text-secondary py-4">Nenhum prontuário encontrado.</td></tr>}
                {dados.itens.map((p) => (
                  <tr key={p.id} onClick={() => navegar(`/prontuarios/${p.id}`)}>
                    <td className="fw-bold">{p.pessoa.nome}</td>
                    <td className="font-monospace small">{fmtCpf(p.pessoa.cpf)}</td>
                    <td>{p.tipoSanguineo ?? '—'}</td>
                    <td>{p.alergias.length ? <span className="badge bg-danger-subtle text-danger-emphasis">{p.alergias.join(', ')}</span> : <span className="text-secondary">—</span>}</td>
                    <td className="text-end font-monospace">{p.totalAtendimentos}</td>
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

export function Prontuario() {
  const { id = '' } = useParams();
  const { dados: p, erro } = useApi<ProntuarioDetalhe>(`/prontuario/${id}`);
  if (erro) return <Erro mensagem={erro} />;
  if (!p) return <Carregando />;
  return (
    <>
      <Link to="/prontuarios" className="small text-decoration-none"><i className="bi bi-arrow-left" /> Prontuários</Link>
      <h1 className="h3 mt-1 mb-1">{p.pessoa.nome}</h1>
      <p className="text-secondary font-monospace">{fmtCpf(p.pessoa.cpf)}{idade(p.pessoa.dataNascimento) ? ` · ${idade(p.pessoa.dataNascimento)}` : ''}</p>
      {p.alergias.length > 0 && <div className="alergias mb-3"><i className="bi bi-exclamation-octagon-fill" />Alergias: {p.alergias.join(', ')}</div>}
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="card h-100"><div className="card-header">Identificação</div>
            <div className="card-body row g-3 small">
              <div className="col-6"><div className="text-secondary">Nascimento</div><div className="fw-bold">{fmtData(p.pessoa.dataNascimento)}</div></div>
              <div className="col-6"><div className="text-secondary">Telefone</div><div className="fw-bold">{p.pessoa.telefone ?? '—'}</div></div>
              <div className="col-12"><div className="text-secondary">Contato</div><div className="fw-bold">{[p.pessoa.contatoNome, p.pessoa.contatoEmail].filter(Boolean).join(' · ') || '—'}</div></div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card h-100"><div className="card-header">Dados clínicos</div>
            <div className="card-body row g-3 small">
              <div className="col-6"><div className="text-secondary">Tipo sanguíneo</div><div className="fw-bold">{p.tipoSanguineo ?? '—'}</div></div>
              <div className="col-6"><div className="text-secondary">Comorbidades</div><div className="fw-bold">{p.comorbidades.join(', ') || '—'}</div></div>
              {p.observacoes && <div className="col-12"><div className="text-secondary">Observações</div><div className="fw-bold">{p.observacoes}</div></div>}
            </div>
          </div>
        </div>
      </div>
      <h2 className="h5">Atendimentos</h2>
      <div className="list-group shadow-sm">
        {p.atendimentos.length === 0 && <div className="list-group-item text-secondary">Nenhum atendimento.</div>}
        {p.atendimentos.map((a) => (
          <Link key={a.id} to={`/atendimentos/${a.id}`} className="list-group-item list-group-item-action d-flex flex-wrap gap-3 align-items-center py-3">
            <TagTriagem triagem={a.triagem} />
            <div className="flex-grow-1"><div className="fw-bold">{a.queixaPrincipal}</div><div className="small text-secondary">{a.local}</div></div>
            <span className="small font-monospace text-secondary">{fmtDataHora(a.dataHora)}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
