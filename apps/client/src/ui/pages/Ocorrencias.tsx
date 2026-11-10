import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { sessao } from '../../auth/session';
import { local } from '../../data/repositories';
import { syncEngine } from '../../sync/engine';
import { SeloSync, TagTriagem, Vazio } from '../components';
import { fmtDataHora } from '../format';
import { useRede, useSync } from '../hooks';
import { fotoBanner } from '../imagens';

export function Ocorrencias() {
  const navegar = useNavigate();
  const rede = useRede();
  const sync = useSync();
  const dados = useLiveQuery(async () => {
    const [atendimentos, pessoas] = await Promise.all([local.atendimentos.listar(), local.pessoas.listar()]);
    return { atendimentos, nomes: new Map(pessoas.map((p) => [p.id, p.nome])) };
  });
  const primeiroNome = sessao.get()?.profissional.nome.replace(/^(Dra?\.|Enf\.)\s*/, '').split(' ')[0];

  return (
    <>
      <section className="banner mb-4">
        <img src={fotoBanner.src} alt="" className="foto-cover" />
        <div className="conteudo d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div>
            <p className="mb-1 opacity-75">Bom plantão{primeiroNome ? `, ${primeiroNome}` : ''}.</p>
            <h1 className="h2 mb-0">Atendimentos</h1>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-light btn-lg" onClick={() => void syncEngine.receber()} disabled={!rede.online || sync.ocupado}>
              <i className="bi bi-cloud-download me-1" />Receber dados
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navegar('/nova')}>
              <i className="bi bi-plus-lg me-1" />Nova ocorrência
            </button>
          </div>
        </div>
      </section>

      {!dados ? (
        <div className="placeholder-glow">{[0, 1, 2].map((i) => <span key={i} className="placeholder col-12 rounded mb-2" style={{ height: 76 }} />)}</div>
      ) : dados.atendimentos.length === 0 ? (
        <div className="card"><Vazio icone="bi-clipboard2-pulse" titulo="Nenhum atendimento neste aparelho.">
          <p className="mb-0">Toque em <strong>Receber dados</strong> para trazer pacientes e medicamentos da central, ou registre uma <strong>Nova ocorrência</strong>.</p>
        </Vazio></div>
      ) : (
        <div className="d-grid gap-2">
          {dados.atendimentos.map((a) => (
            <Link key={a.id} to={`/atendimento/${a.id}`} className="card card-link-hover text-decoration-none text-body">
              <div className="card-body d-flex flex-wrap align-items-center gap-3">
                <TagTriagem triagem={a.triagem} />
                <div className="flex-grow-1" style={{ minWidth: 200 }}>
                  <div className="fw-bold">{dados.nomes.get(a.pessoaId) ?? 'Paciente'}</div>
                  <div className="text-secondary small">{a.queixaPrincipal} · {a.local}</div>
                </div>
                <div className="text-md-end">
                  <div className="small text-secondary font-monospace mb-1">{fmtDataHora(a.dataHora)}</div>
                  <SeloSync status={a.syncStatus} offline={a.criadoOffline} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
