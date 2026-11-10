import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROTULO_CLASSIFICACAO, significadoClassificacao, type Triagem } from '@medicalfield/shared';
import { sair, useSessao } from './api';

export function Marca() {
  return (
    <span className="marca">
      <svg className="marca-cruz" viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#d0263a" />
        <path d="M10 5h4v5h5v4h-5v5h-4v-5H5v-4h5z" fill="#fff" />
      </svg>
      <span>MedicalField <span className="fw-normal text-secondary">Central</span></span>
    </span>
  );
}

export function TagTriagem({ triagem, completa }: { triagem: Triagem; completa?: boolean }) {
  return (
    <span className="triagem" data-cor={triagem.classificacao}>
      {ROTULO_CLASSIFICACAO[triagem.classificacao]}
      {completa && <span className="fw-normal">· {significadoClassificacao(triagem.protocolo, triagem.classificacao)}</span>}
    </span>
  );
}

export const SeloOffline = () => <span className="badge rounded-pill badge-offline">Registrado offline</span>;

export function Carregando() {
  return <div className="placeholder-glow">{[0, 1, 2, 3].map((i) => <span key={i} className="placeholder col-12 rounded mb-2" style={{ height: 48 }} />)}</div>;
}

export const Erro = ({ mensagem }: { mensagem: string }) => <div className="alert alert-danger"><i className="bi bi-x-octagon me-1" />{mensagem}</div>;

export function Layout({ children }: { children: ReactNode }) {
  const s = useSessao();
  const navegar = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;
  return (
    <>
      <nav className="navbar navbar-mf sticky-top shadow-sm">
        <div className="container gap-2 flex-wrap">
          <NavLink to="/" className="navbar-brand p-0"><Marca /></NavLink>
          <ul className="navbar-nav flex-row gap-1 me-auto">
            <li className="nav-item"><NavLink to="/atendimentos" className={link}><i className="bi bi-clipboard2-pulse me-1" />Atendimentos</NavLink></li>
            <li className="nav-item"><NavLink to="/prontuarios" className={link}><i className="bi bi-journal-medical me-1" />Prontuários</NavLink></li>
            <li className="nav-item"><NavLink to="/cadastros" className={link}><i className="bi bi-database me-1" />Cadastros</NavLink></li>
          </ul>
          <div className="d-flex align-items-center gap-2 small">
            <span className="text-secondary d-none d-md-inline"><i className="bi bi-person-circle me-1" />{s?.profissional.nome}</span>
            <button type="button" className="btn btn-sm btn-light border" onClick={() => { sair(); navegar('/entrar'); }}><i className="bi bi-box-arrow-right" /> Sair</button>
          </div>
        </div>
      </nav>
      <main className="container py-4">{children}</main>
    </>
  );
}
