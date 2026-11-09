import { ClipboardList, LogOut, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { sessao } from '../../auth/session';
import { db } from '../../data/db';
import { network } from '../../sync/network';
import { usePendentes, useRede, useSessao, useSync } from '../hooks';

const NAV = [
  { para: '/', rotulo: 'Ocorrências', icone: ClipboardList, fim: true },
  { para: '/pacientes', rotulo: 'Pacientes', icone: Users },
  { para: '/sincronizacao', rotulo: 'Sincronização', icone: RefreshCw },
];

/** Chave "Simular conectividade (Online / Offline)". */
export function ChaveRede() {
  const rede = useRede();
  return (
    <label className="chave-rede" data-online={rede.online}>
      <input
        type="checkbox"
        role="switch"
        checked={rede.simulador}
        onChange={(e) => network.setSimulador(e.target.checked)}
        aria-describedby="chave-rede-ajuda"
      />
      <span className="trilho" aria-hidden />
      <span className="chave-rotulo">
        {rede.online ? <Wifi aria-hidden /> : <WifiOff aria-hidden />}
        <strong>{rede.online ? 'Online' : 'Offline'}</strong>
      </span>
      <span id="chave-rede-ajuda" className="sr-only">
        Simular conectividade. {rede.simulador ? '' : 'Simulador desligado.'} {rede.redeReal ? '' : 'Sem rede no aparelho.'}
      </span>
    </label>
  );
}

function Pendentes() {
  const { total, erros } = usePendentes();
  const sync = useSync();
  const navegar = useNavigate();
  const rotulo = sync.sincronizando
    ? sync.fase === 'RECEBENDO'
      ? 'Recebendo…'
      : 'Enviando…'
    : total === 0
      ? 'Tudo na central'
      : `${total} ${total === 1 ? 'pendente' : 'pendentes'}`;
  return (
    <button
      type="button"
      className="pendentes"
      data-estado={erros ? 'erro' : total ? 'pendente' : 'ok'}
      data-ativo={sync.sincronizando}
      onClick={() => navegar('/sincronizacao')}
      aria-label={`${rotulo}. Abrir sincronização.`}
    >
      <RefreshCw aria-hidden className="giro" />
      <span className="pend-longo">{rotulo}</span>
      {total > 0 && <span className="pend-curto mono" aria-hidden>{total}</span>}
    </button>
  );
}

export function Casca({ children }: { children: ReactNode }) {
  const s = useSessao();
  const rede = useRede();
  const navegar = useNavigate();

  const sair = async () => {
    const pend = await db.outbox.where('status').anyOf('PENDENTE', 'ENVIANDO', 'ERRO').count();
    if (pend && !window.confirm(`Há ${pend} registro(s) que ainda não chegaram à central. Eles continuam guardados neste aparelho. Sair mesmo assim?`)) return;
    sessao.definir(null);
    navegar('/entrar');
  };

  return (
    <div className="app" data-online={rede.online}>
      <header className="casca">
        <div className="casca-linha">
          <div className="marca">
            <svg viewBox="0 0 24 24" aria-hidden className="marca-cruz">
              <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
            </svg>
            <span>MedicalField</span>
          </div>
          <nav className="nav-topo" aria-label="Seções">
            {NAV.map((n) => (
              <NavLink key={n.para} to={n.para} end={n.fim}>
                {n.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="casca-acoes">
            <Pendentes />
            <ChaveRede />
          </div>
        </div>
        <div className="faixa-refletiva" aria-hidden />
        {!rede.online && (
          <p className="aviso-offline" role="status">
            Fora da rede: tudo que você registrar fica guardado neste aparelho e vai para a central quando a conexão voltar.
          </p>
        )}
      </header>

      <main className="conteudo">{children}</main>

      <footer className="rodape-usuario">
        <span>
          {s?.profissional.nome} · {s?.profissional.tipoRegistro} {s?.profissional.numeroRegistro}
          {s?.profissional.uf ? `/${s.profissional.uf}` : ''}
          {s?.modo === 'OFFLINE' && ' · sessão offline'}
        </span>
        <button type="button" className="btn btn-fantasma" onClick={sair}>
          <LogOut aria-hidden /> Sair
        </button>
      </footer>

      <nav className="nav-inferior" aria-label="Seções">
        {NAV.map((n) => (
          <NavLink key={n.para} to={n.para} end={n.fim}>
            <n.icone aria-hidden />
            <span>{n.rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
