import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { sessao } from '../auth/session';
import { network } from '../sync/network';
import { Marca } from './components';
import { usePendentes, useRede, useSync } from './hooks';

/** Chave "Simular conectividade (Online / Offline)". */
export function ChaveRede() {
  const rede = useRede();
  return (
    <div className={`form-check form-switch mb-0 px-3 py-1 rounded-pill ${rede.online ? 'bg-success-subtle' : 'bg-warning-subtle'}`}>
      <input
        className="form-check-input ms-0 me-2"
        type="checkbox"
        role="switch"
        id="chave-rede"
        checked={rede.simulador}
        onChange={(e) => network.setSimulador(e.target.checked)}
      />
      <label className="form-check-label fw-bold" htmlFor="chave-rede">
        <i className={`bi ${rede.online ? 'bi-wifi' : 'bi-wifi-off'} me-1`} />
        {rede.online ? 'Online' : 'Offline'}
      </label>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const rede = useRede();
  const pendentes = usePendentes();
  const sync = useSync();
  const navegar = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

  return (
    <>
      <nav className="navbar navbar-mf sticky-top shadow-sm">
        <div className="container gap-2 flex-wrap">
          <NavLink to="/" className="navbar-brand p-0"><Marca /></NavLink>
          <ul className="navbar-nav flex-row gap-1 order-3 order-lg-2 col-12 col-lg-auto me-lg-auto">
            <li className="nav-item"><NavLink to="/" end className={link}><i className="bi bi-clipboard2-pulse me-1" />Atendimentos</NavLink></li>
            <li className="nav-item"><NavLink to="/pacientes" className={link}><i className="bi bi-people me-1" />Pacientes</NavLink></li>
            <li className="nav-item"><NavLink to="/sincronizar" className={link}><i className="bi bi-arrow-repeat me-1" />Sincronizar</NavLink></li>
          </ul>
          <div className="d-flex align-items-center gap-2 order-2 order-lg-3 ms-auto ms-lg-0">
            <button type="button" className={`btn btn-sm rounded-pill ${pendentes ? 'btn-warning' : 'btn-light border'}`} onClick={() => navegar('/sincronizar')}>
              {sync.ocupado ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-cloud-arrow-up" />}{' '}
              {pendentes ? `${pendentes} pendente${pendentes > 1 ? 's' : ''}` : 'Tudo na central'}
            </button>
            <ChaveRede />
          </div>
        </div>
      </nav>
      {!rede.online && (
        <>
          <div className="faixa-offline" />
          <div className="bg-warning-subtle border-bottom border-warning-subtle small py-2">
            <div className="container">
              <i className="bi bi-exclamation-triangle-fill text-warning-emphasis me-1" />
              <strong>Você está offline.</strong> Tudo o que registrar fica guardado neste aparelho e vai para a central quando a conexão voltar.
            </div>
          </div>
        </>
      )}
      <main className="container py-4">{children}</main>
      <footer className="container pb-4 d-flex justify-content-between align-items-center small text-secondary">
        <span><i className="bi bi-person-badge me-1" />{sessao.assinatura()}</span>
        <button type="button" className="btn btn-sm btn-link text-secondary" onClick={() => { sessao.sair(); navegar('/entrar'); }}>
          <i className="bi bi-box-arrow-right" /> Sair
        </button>
      </footer>
    </>
  );
}
