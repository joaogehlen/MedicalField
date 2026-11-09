import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { normalizarTexto, somenteDigitos } from '@medicalfield/shared';
import { local } from '../../data/repositories';
import { SeloSync } from '../components/Selos';
import { fmtCpf, idade } from '../format';

export function Pacientes() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const pessoas = useLiveQuery(() => local.pessoas.listar());
  const termo = normalizarTexto(busca);
  const digitos = somenteDigitos(busca);
  const filtradas = (pessoas ?? []).filter(
    (p) => !termo || normalizarTexto(p.nome).includes(termo) || (digitos.length >= 3 && (p.cpf ?? '').includes(digitos)),
  );

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <h1>Pacientes</h1>
        <button type="button" className="btn btn-grande" onClick={() => navegar('/nova')}>
          <UserPlus aria-hidden /> Nova vítima
        </button>
      </div>
      <div className="campo busca">
        <label htmlFor="busca" className="sr-only">
          Buscar por nome ou CPF
        </label>
        <Search aria-hidden />
        <input id="busca" type="search" placeholder="Buscar por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {pessoas && filtradas.length === 0 ? (
        <div className="vazio">
          <strong>{busca ? 'Nenhum paciente encontrado.' : 'Nenhum paciente neste aparelho.'}</strong>
          <p>{busca ? 'Confira a grafia ou o CPF, ou registre a vítima como nova.' : 'Receba os dados da central na aba Sincronização, ou registre uma nova vítima.'}</p>
        </div>
      ) : (
        <ul className="lista-ocorrencias">
          {filtradas.map((p) => (
            <li key={p.id}>
              <Link to={`/paciente/${p.id}`} className="ocorrencia">
                <div className="ocorrencia-texto">
                  <strong>{p.nome}</strong>
                  <span className="mono">{p.identificada ? fmtCpf(p.cpf) : 'Não identificado'}{idade(p.dataNascimento) ? ` · ${idade(p.dataNascimento)}` : ''}</span>
                </div>
                <div className="ocorrencia-meta">
                  <SeloSync status={p.syncStatus} erro={p.syncErro} />
                </div>
                <ChevronRight aria-hidden className="seta" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
