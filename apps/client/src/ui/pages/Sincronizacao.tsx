import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { syncEngine } from '../../sync/engine';
import { Vazio } from '../components';
import { relativo } from '../format';
import { ChaveRede } from '../Layout';
import { useRede, useSync } from '../hooks';

const TIPO = { PESSOA: 'Paciente', PRONTUARIO: 'Prontuário', ATENDIMENTO: 'Atendimento' } as const;

export function Sincronizacao() {
  const rede = useRede();
  const sync = useSync();
  const ops = useLiveQuery(() => db.outbox.where('status').anyOf('PENDENTE', 'ERRO').sortBy('seq'));
  const qtd = useLiveQuery(async () => ({
    pacientes: await db.pessoas.count(), atendimentos: await db.atendimentos.count(), medicamentos: await db.medicamentos.count(),
  }));

  return (
    <div className="mx-auto" style={{ maxWidth: 900 }}>
      <h1 className="h3 mb-3">Sincronização</h1>
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card h-100"><div className="card-body">
            <div className="small text-secondary mb-2">Simulador de conectividade</div>
            <ChaveRede />
            <p className="small text-secondary mt-2 mb-0">Desligue para testar o modo offline.</p>
          </div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card h-100"><div className="card-body">
            <div className="small text-secondary">Último envio</div>
            <div className="fs-5 fw-bold">{sync.ultimoEnvio ? relativo(sync.ultimoEnvio) : 'Nunca'}</div>
            <button type="button" className="btn btn-primary mt-2" disabled={!rede.online || sync.ocupado} onClick={() => void syncEngine.enviar()}>
              <i className="bi bi-cloud-upload me-1" />Enviar
            </button>
          </div></div>
        </div>
        <div className="col-6 col-md-4">
          <div className="card h-100"><div className="card-body">
            <div className="small text-secondary">Último recebimento</div>
            <div className="fs-5 fw-bold">{sync.ultimoRecebimento ? relativo(sync.ultimoRecebimento) : 'Nunca'}</div>
            <button type="button" className="btn btn-outline-primary mt-2" disabled={!rede.online || sync.ocupado} onClick={() => void syncEngine.receber()}>
              <i className="bi bi-cloud-download me-1" />Receber
            </button>
          </div></div>
        </div>
      </div>

      <h2 className="h5">Dados neste aparelho</h2>
      <div className="row g-3 mb-4 text-center">
        {([['pacientes', 'Pacientes', 'bi-people'], ['atendimentos', 'Atendimentos', 'bi-clipboard2-pulse'], ['medicamentos', 'Medicamentos', 'bi-capsule']] as const).map(([k, rotulo, icone]) => (
          <div key={k} className="col-4">
            <div className="card"><div className="card-body py-3">
              <i className={`bi ${icone} text-primary`} />
              <div className="fs-3 fw-bold font-monospace" id={`qtd-${k}`}>{qtd?.[k] ?? '—'}</div>
              <div className="small text-secondary">{rotulo}</div>
            </div></div>
          </div>
        ))}
      </div>

      {sync.erro && <div className="alert alert-danger"><i className="bi bi-x-octagon me-1" />{sync.erro}</div>}

      <h2 className="h5">Aguardando envio</h2>
      {ops && ops.length === 0 ? (
        <div className="card"><Vazio icone="bi-cloud-check" titulo="Tudo enviado para a central." /></div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light"><tr><th>#</th><th>Registro</th><th>Criado</th><th>Situação</th></tr></thead>
              <tbody>
                {(ops ?? []).map((o) => (
                  <tr key={o.seq}>
                    <td className="font-monospace">{o.seq}</td>
                    <td>{TIPO[o.tipo]}</td>
                    <td className="small">{relativo(o.criadoEm)}</td>
                    <td>{o.status === 'ERRO' ? <span className="badge text-bg-danger" title={o.erro ?? ''}>Recusado: {o.erro}</span> : <span className="badge text-bg-warning">Pendente</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
