import { useState } from 'react';
import { registroProfissional, type Medicamento, type Profissional } from '@medicalfield/shared';
import { useApi } from '../api';
import { Carregando, Erro } from '../ui';

const PAPEL = { MEDICO: 'Médico(a)', ENFERMEIRO: 'Enfermeiro(a)', SOCORRISTA: 'Socorrista', ADMIN: 'Administrador' } as const;

function Medicamentos() {
  const { dados, erro } = useApi<Medicamento[]>('/medicamento');
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;
  return (
    <table className="table align-middle mb-0">
      <thead><tr><th>Medicamento</th><th>Vias</th><th className="text-end">Dose máxima</th><th>Alérgenos</th></tr></thead>
      <tbody>
        {dados.map((m) => (
          <tr key={m.id}>
            <td><div className="fw-bold">{m.nome}</div><div className="small text-secondary">{m.apresentacao}</div></td>
            <td>{m.viasPermitidas.map((v) => <span key={v} className="badge text-bg-light border me-1">{v}</span>)}</td>
            <td className="text-end font-monospace">{m.doseMaxima} {m.unidade}</td>
            <td className="small">{m.alergenos.join(', ') || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Profissionais() {
  const { dados, erro } = useApi<Profissional[]>('/profissional');
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;
  return (
    <table className="table align-middle mb-0">
      <thead><tr><th>Nome</th><th>Registro</th><th>Função</th><th>Situação</th></tr></thead>
      <tbody>
        {dados.map((p) => (
          <tr key={p.id}>
            <td className="fw-bold">{p.nome}</td>
            <td className="font-monospace">{registroProfissional(p)}</td>
            <td>{PAPEL[p.papel]}</td>
            <td>{p.ativo ? <span className="badge text-bg-success">Ativo</span> : <span className="badge text-bg-secondary">Inativo</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Cadastros() {
  const [aba, setAba] = useState<'med' | 'prof'>('med');
  return (
    <>
      <h1 className="h3 mb-3">Cadastros</h1>
      <ul className="nav nav-tabs">
        <li className="nav-item"><button type="button" className={`nav-link ${aba === 'med' ? 'active' : ''}`} onClick={() => setAba('med')}><i className="bi bi-capsule me-1" />Medicamentos</button></li>
        <li className="nav-item"><button type="button" className={`nav-link ${aba === 'prof' ? 'active' : ''}`} onClick={() => setAba('prof')}><i className="bi bi-person-badge me-1" />Profissionais</button></li>
      </ul>
      <div className="card border-top-0 rounded-top-0">
        <div className="table-responsive">{aba === 'med' ? <Medicamentos /> : <Profissionais />}</div>
      </div>
    </>
  );
}
