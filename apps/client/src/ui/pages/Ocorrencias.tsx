import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Download, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { local } from '../../data/repositories';
import { syncEngine } from '../../sync/engine';
import { SeloOffline, SeloSync } from '../components/Selos';
import { TagTriagem } from '../components/Triagem';
import { fmtDataHora, fmtQuando } from '../format';
import { useRede, useSync } from '../hooks';

export function Ocorrencias() {
  const navegar = useNavigate();
  const rede = useRede();
  const sync = useSync();
  const dados = useLiveQuery(async () => {
    const [atendimentos, pessoas] = await Promise.all([local.atendimentos.listar(), local.pessoas.listar()]);
    return { atendimentos, nomes: new Map(pessoas.map((p) => [p.id, p.nome])) };
  });

  const emAndamento = dados?.atendimentos.filter((a) => a.status === 'RASCUNHO') ?? [];
  const finalizados = dados?.atendimentos.filter((a) => a.status === 'FINALIZADO') ?? [];

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <h1>Ocorrências</h1>
        <button type="button" className="btn btn-primario btn-grande" onClick={() => navegar('/nova')}>
          <Plus aria-hidden /> Nova ocorrência
        </button>
      </div>

      {!dados ? (
        <div className="lista-ocorrencias">
          {[0, 1, 2].map((i) => (
            <div key={i} className="esqueleto" style={{ height: 72 }} />
          ))}
        </div>
      ) : dados.atendimentos.length === 0 ? (
        <div className="vazio">
          <strong>Nenhuma ocorrência neste aparelho.</strong>
          <p>Receba da central os pacientes e o catálogo de medicamentos, ou registre uma nova ocorrência — funciona com ou sem conexão.</p>
          <div className="acoes">
            <button type="button" className="btn" onClick={() => void syncEngine.pull()} disabled={!rede.online} data-carregando={sync.fase === 'RECEBENDO'}>
              <Download aria-hidden /> Receber dados da central
            </button>
          </div>
        </div>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <section aria-labelledby="t-andamento">
              <h2 id="t-andamento" className="grupo-titulo">Em andamento</h2>
              <ul className="lista-ocorrencias">
                {emAndamento.map((a) => (
                  <Linha key={a.id} a={a} nome={dados.nomes.get(a.pessoaId)} />
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="t-finalizados">
            <h2 id="t-finalizados" className="grupo-titulo">Finalizadas</h2>
            {finalizados.length === 0 ? (
              <p className="nota">Nenhuma ocorrência finalizada ainda.</p>
            ) : (
              <ul className="lista-ocorrencias">
                {finalizados.map((a) => (
                  <Linha key={a.id} a={a} nome={dados.nomes.get(a.pessoaId)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Linha({ a, nome }: { a: import('../../data/db').AtendimentoLocal; nome?: string }) {
  return (
    <li>
      <Link to={`/atendimento/${a.id}`} className="ocorrencia">
        <TagTriagem triagem={a.triagem} />
        <div className="ocorrencia-texto">
          <strong>{nome ?? 'Paciente'}</strong>
          <span>{a.queixaPrincipal}</span>
        </div>
        <div className="ocorrencia-meta">
          <time dateTime={a.iniciadoEm} title={fmtDataHora(a.iniciadoEm)}>
            {fmtQuando(a.iniciadoEm)}
          </time>
          <div className="selos">
            {a.criadoOffline && <SeloOffline />}
            <SeloSync status={a.syncStatus} erro={a.syncErro} />
          </div>
        </div>
        <ChevronRight aria-hidden className="seta" />
      </Link>
    </li>
  );
}
