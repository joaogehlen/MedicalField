import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CAMPOS_VITAIS, glasgowGravidade, type AtendimentoDetalhe as Detalhe, type EnvioEmailResponse } from '@medicalfield/shared';
import { api, baixar, useApi } from '../api';
import { fmtCpf, fmtDataHora, fmtHora, idade } from '../format';
import { Carregando, Erro, SeloOffline, TagTriagem } from '../ui';

function EnvioFicha({ a }: { a: Detalhe }) {
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [estado, setEstado] = useState<{ ok?: string; erro?: string; enviando?: boolean }>({});
  useEffect(() => {
    setEmail(a.pessoa.contatoEmail ?? a.pessoa.email ?? '');
    setNome(a.pessoa.contatoEmail ? a.pessoa.contatoNome ?? '' : a.pessoa.nome);
  }, [a]);

  async function pdf() {
    try {
      const url = URL.createObjectURL(await baixar(`/ficha/${a.id}/pdf`));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setEstado({ erro: e instanceof Error ? e.message : 'Falha ao gerar o PDF.' });
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEstado({ enviando: true });
    try {
      const r = await api<EnvioEmailResponse>('POST', `/ficha/${a.id}/email`, { email, nome: nome || null });
      setEstado({ ok: `Ficha enviada para ${r.enviadoPara}.` });
    } catch (err) {
      setEstado({ erro: err instanceof Error ? err.message : 'Falha no envio.' });
    }
  }

  return (
    <div className="card">
      <div className="card-header"><i className="bi bi-file-earmark-medical me-1" />Ficha de atendimento</div>
      <div className="card-body">
        <button type="button" className="btn btn-outline-primary w-100 mb-3" onClick={() => void pdf()}><i className="bi bi-file-earmark-pdf me-1" />Gerar ficha (PDF)</button>
        <form onSubmit={enviar} className="d-grid gap-2">
          <label className="form-label mb-0" htmlFor="email">Enviar por e-mail</label>
          <input id="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="familiar@exemplo.com" required />
          <input className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do destinatário" aria-label="Nome do destinatário" />
          <button type="submit" className="btn btn-primary" disabled={!email || estado.enviando}>
            {estado.enviando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-envelope me-1" />}Enviar ficha
          </button>
        </form>
        {estado.ok && <div className="alert alert-success mt-3 mb-0 py-2"><i className="bi bi-check-circle me-1" />{estado.ok}</div>}
        {estado.erro && <div className="alert alert-danger mt-3 mb-0 py-2">{estado.erro}</div>}
      </div>
    </div>
  );
}

export function AtendimentoDetalhe() {
  const { id = '' } = useParams();
  const { dados: a, erro } = useApi<Detalhe>(`/atendimento/detalhe/${id}`);
  if (erro) return <Erro mensagem={erro} />;
  if (!a) return <Carregando />;
  const med = (mid: string) => a.medicamentosCatalogo.find((m) => m.id === mid);

  return (
    <>
      <Link to="/atendimentos" className="small text-decoration-none"><i className="bi bi-arrow-left" /> Atendimentos</Link>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mt-1 mb-3">
        <div>
          <h1 className="h3 mb-1">{a.pessoa.nome}</h1>
          <div className="text-secondary">{a.queixaPrincipal} · <span className="font-monospace">{fmtDataHora(a.dataHora)}</span></div>
        </div>
        <div className="d-flex gap-2 align-items-center">{a.criadoOffline && <SeloOffline />}<TagTriagem triagem={a.triagem} completa /></div>
      </div>
      {a.prontuario.alergias.length > 0 && <div className="alergias mb-3"><i className="bi bi-exclamation-octagon-fill" />Alergias: {a.prontuario.alergias.join(', ')}</div>}

      <div className="row g-3">
        <div className="col-lg-8 d-grid gap-3">
          <div className="card">
            <div className="card-header d-flex justify-content-between">Paciente <Link to={`/prontuarios/${a.prontuario.id}`} className="small">Ver prontuário</Link></div>
            <div className="card-body row g-3 small">
              <div className="col-6 col-md-3"><div className="text-secondary">CPF</div><div className="fw-bold font-monospace">{fmtCpf(a.pessoa.cpf)}</div></div>
              <div className="col-6 col-md-3"><div className="text-secondary">Idade</div><div className="fw-bold">{idade(a.pessoa.dataNascimento) ?? '—'}</div></div>
              <div className="col-6 col-md-3"><div className="text-secondary">Tipo sanguíneo</div><div className="fw-bold">{a.prontuario.tipoSanguineo ?? '—'}</div></div>
              <div className="col-6 col-md-3"><div className="text-secondary">Comorbidades</div><div className="fw-bold">{a.prontuario.comorbidades.join(', ') || '—'}</div></div>
              <div className="col-12"><div className="text-secondary">Local da ocorrência</div><div className="fw-bold">{a.local}</div></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex justify-content-between">Avaliação <span className="badge text-bg-light border">Glasgow {a.glasgow.total} · {glasgowGravidade(a.glasgow.total)}</span></div>
            <div className="card-body row g-3 small">
              {CAMPOS_VITAIS.map((c) => (
                <div key={c.campo} className="col-6 col-md-3">
                  <div className="text-secondary">{c.rotulo}</div>
                  <div className="fw-bold">{a.sinaisVitais[c.campo] ?? '—'} {a.sinaisVitais[c.campo] != null && <span className="fw-normal text-secondary">{c.unidade}</span>}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header">Medicamentos administrados</div>
            {a.medicamentos.length === 0 ? <div className="card-body text-secondary">Nenhum.</div> : (
              <ul className="list-group list-group-flush">
                {a.medicamentos.map((m) => (
                  <li key={m.id} className="list-group-item d-flex justify-content-between">
                    <span><i className="bi bi-capsule text-primary me-2" /><strong>{med(m.medicamentoId)?.nome}</strong> · {m.dose} {med(m.medicamentoId)?.unidade} · {m.via}</span>
                    <span className="font-monospace text-secondary">{fmtHora(m.horario)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {a.observacoes && <div className="card"><div className="card-header">Observações</div><div className="card-body">{a.observacoes}</div></div>}
          <p className="small text-secondary mb-0"><i className="bi bi-person-badge me-1" />Atendido por {a.profissionalNome}{a.sincronizadoEm ? ` · recebido pela central em ${fmtDataHora(a.sincronizadoEm)}` : ''}</p>
        </div>
        <div className="col-lg-4"><EnvioFicha a={a} /></div>
      </div>
    </>
  );
}
