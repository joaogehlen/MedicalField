import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { normalizarTexto, somenteDigitos } from '@medicalfield/shared';
import { local } from '../../data/repositories';
import { SeloSync, Vazio } from '../components';
import { fmtCpf, idade } from '../format';

export function Pacientes() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const pessoas = useLiveQuery(() => local.pessoas.listar());
  const termo = normalizarTexto(busca);
  const digitos = somenteDigitos(busca);
  const lista = (pessoas ?? []).filter(
    (p) => !termo || normalizarTexto(p.nome).includes(termo) || (digitos.length >= 3 && (p.cpf ?? '').includes(digitos)),
  );

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Pacientes</h1>
        <button type="button" className="btn btn-primary" onClick={() => navegar('/nova')}><i className="bi bi-person-plus me-1" />Nova vítima</button>
      </div>
      <div className="input-group input-group-lg mb-3">
        <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
        <input className="form-control" type="search" placeholder="Buscar por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar paciente" />
      </div>
      {pessoas && lista.length === 0 ? (
        <div className="card"><Vazio icone="bi-people" titulo={busca ? 'Nenhum paciente encontrado.' : 'Nenhum paciente neste aparelho.'}>
          <p className="mb-0">{busca ? 'Confira o nome ou o CPF.' : 'Receba os dados da central ou cadastre uma nova vítima.'}</p>
        </Vazio></div>
      ) : (
        <div className="list-group shadow-sm">
          {lista.map((p) => (
            <Link key={p.id} to={`/paciente/${p.id}`} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2 py-3">
              <div>
                <div className="fw-bold">{p.nome}</div>
                <div className="small text-secondary font-monospace">{fmtCpf(p.cpf)}{idade(p.dataNascimento) ? ` · ${idade(p.dataNascimento)}` : ''}</div>
              </div>
              <SeloSync status={p.syncStatus} offline={p.criadoOffline} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
