import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { CAMPOS_VITAIS, glasgowGravidade } from '@medicalfield/shared';
import { db } from '../../data/db';
import { local } from '../../data/repositories';
import { SeloSync, TagTriagem } from '../components';
import { fmtDataHora, fmtHora } from '../format';

export function AtendimentoVer() {
  const { id = '' } = useParams();
  const dados = useLiveQuery(async () => {
    const a = await local.atendimentos.buscar(id);
    if (!a) return { a };
    const [pessoa, prontuario, catalogo, op] = await Promise.all([
      local.pessoas.buscar(a.pessoaId), local.prontuarios.buscar(a.prontuarioId), local.medicamentos.listar(),
      db.outbox.where('entidadeId').equals(id).last(),
    ]);
    return { a, pessoa, prontuario, catalogo, op };
  }, [id]);
  if (!dados) return null;
  const { a } = dados;
  if (!a) return <div className="alert alert-secondary">Atendimento não encontrado neste aparelho.</div>;
  const med = (mid: string) => dados.catalogo?.find((m) => m.id === mid);

  return (
    <div className="mx-auto" style={{ maxWidth: 900 }}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <Link to={`/paciente/${a.pessoaId}`} className="small text-decoration-none"><i className="bi bi-arrow-left" /> {dados.pessoa?.nome ?? 'Paciente'}</Link>
          <h1 className="h3 mb-1 mt-1">{a.queixaPrincipal}</h1>
          <div className="text-secondary"><span className="font-monospace">{fmtDataHora(a.dataHora)}</span> · {a.local}</div>
        </div>
        <div className="d-flex flex-column align-items-end gap-2">
          <TagTriagem triagem={a.triagem} completa />
          <SeloSync status={a.syncStatus} offline={a.criadoOffline} />
        </div>
      </div>

      {a.syncStatus === 'ERRO' && dados.op?.erro && <div className="alert alert-danger"><strong>A central recusou este registro:</strong> {dados.op.erro}</div>}
      {dados.prontuario?.alergias.length ? <div className="alergias mb-3"><i className="bi bi-exclamation-octagon-fill" />Alergias: {dados.prontuario.alergias.join(', ')}</div> : null}

      <div className="row g-3">
        <div className="col-md-4">
          <div className="card h-100 text-center">
            <div className="card-header">Glasgow</div>
            <div className="card-body">
              <div className="display-5 fw-bold">{a.glasgow.total}</div>
              <div className="text-secondary">{glasgowGravidade(a.glasgow.total)}</div>
              <div className="small text-secondary mt-2">O{a.glasgow.ocular} · V{a.glasgow.verbal} · M{a.glasgow.motora}</div>
            </div>
          </div>
        </div>
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-header">Sinais vitais</div>
            <div className="card-body row g-3">
              {CAMPOS_VITAIS.map((c) => (
                <div key={c.campo} className="col-6 col-md-3">
                  <div className="small text-secondary">{c.rotulo}</div>
                  <div className="fw-bold">{a.sinaisVitais[c.campo] ?? '—'} {a.sinaisVitais[c.campo] != null && <span className="fw-normal small text-secondary">{c.unidade}</span>}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-12">
          <div className="card">
            <div className="card-header">Medicamentos administrados</div>
            {a.medicamentos.length === 0 ? (
              <div className="card-body text-secondary">Nenhum medicamento.</div>
            ) : (
              <ul className="list-group list-group-flush">
                {a.medicamentos.map((m) => (
                  <li key={m.id} className="list-group-item d-flex justify-content-between">
                    <span><i className="bi bi-capsule text-primary me-2" /><strong>{med(m.medicamentoId)?.nome ?? 'Medicamento'}</strong> · {m.dose} {med(m.medicamentoId)?.unidade} · {m.via}</span>
                    <span className="font-monospace text-secondary">{fmtHora(m.horario)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {a.observacoes && <div className="col-12"><div className="card"><div className="card-header">Observações</div><div className="card-body">{a.observacoes}</div></div></div>}
      </div>
      <p className="small text-secondary mt-3"><i className="bi bi-person-badge me-1" />Atendido por {a.profissionalNome}</p>
    </div>
  );
}
