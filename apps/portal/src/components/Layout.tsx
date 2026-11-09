import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { sair, useSessao } from '../api';

const NAV = [
  { para: '/atendimentos', rotulo: 'Atendimentos' },
  { para: '/prontuarios', rotulo: 'Prontuários' },
  { para: '/cadastros', rotulo: 'Cadastros' },
  { para: '/auditoria', rotulo: 'Auditoria' },
];

export function Layout({ children }: { children: ReactNode }) {
  const s = useSessao();
  return (
    <div className="portal">
      <header className="barra">
        <div className="barra-linha">
          <div className="marca">
            <svg viewBox="0 0 24 24" aria-hidden className="marca-cruz"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
            <span>MedicalField</span>
            <span className="marca-sub">Regulação</span>
          </div>
          <nav aria-label="Seções" className="barra-nav">
            {NAV.map((n) => (
              <NavLink key={n.para} to={n.para}>{n.rotulo}</NavLink>
            ))}
          </nav>
          <div className="barra-usuario">
            <span>{s?.profissional.nome}</span>
            <button type="button" className="btn btn-fantasma" onClick={() => void sair()}>
              <LogOut aria-hidden /> Sair
            </button>
          </div>
        </div>
      </header>
      <main className="principal">{children}</main>
    </div>
  );
}
