import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  avaliarAdministracao, CAMPOS_VITAIS, CLASSIFICACOES_POR_PROTOCOLO, GLASGOW_MOTORA, GLASGOW_OCULAR, GLASGOW_VERBAL,
  glasgowGravidade, ROTULO_CLASSIFICACAO, significadoClassificacao,
  type Classificacao, type MedicamentoAdministrado, type ProtocoloTriagem, type SinaisVitais, type ViaAdministracao,
} from '@medicalfield/shared';
import { sessao } from '../../auth/session';
import { local } from '../../data/repositories';
import { novoId, salvarAtendimento } from '../../services/registro';
import { Erros, Etapas, mensagensDoErro } from '../components';
import { paraInput } from '../format';

export function AtendimentoForm() {
  const { id: pessoaId = '' } = useParams();
  const nova = useSearchParams()[0].get('nova') === '1';
  const navegar = useNavigate();
  const dados = useLiveQuery(async () => ({
    pessoa: await local.pessoas.buscar(pessoaId),
    prontuario: await local.prontuarios.daPessoa(pessoaId),
    catalogo: (await local.medicamentos.listar()).filter((m) => m.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  }), [pessoaId]);

  const [dataHora, setDataHora] = useState(paraInput(new Date().toISOString()));
  const [localOc, setLocalOc] = useState('');
  const [queixa, setQueixa] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [protocolo, setProtocolo] = useState<ProtocoloTriagem>('START');
  const [classificacao, setClassificacao] = useState<Classificacao | ''>('');
  const [glasgow, setGlasgow] = useState({ ocular: 4, verbal: 5, motora: 6 });
  const [vitais, setVitais] = useState<Record<string, string>>({});
  const [meds, setMeds] = useState<MedicamentoAdministrado[]>([]);
  const [novo, setNovo] = useState({ medicamentoId: '', dose: '', via: '' });
  const [alertas, setAlertas] = useState<string[]>([]);
  const [erros, setErros] = useState<string[]>([]);

  if (!dados) return null;
  const { pessoa, prontuario, catalogo } = dados;
  if (!pessoa || !prontuario) return <div className="alert alert-secondary">Abra o prontuário do paciente antes de registrar o atendimento.</div>;

  const totalGlasgow = glasgow.ocular + glasgow.verbal + glasgow.motora;
  const medSelecionado = catalogo.find((m) => m.id === novo.medicamentoId);
  const nomeMed = (id: string) => catalogo.find((m) => m.id === id)?.nome ?? 'Medicamento';

  function adicionarMedicamento() {
    if (!medSelecionado || !novo.dose || !novo.via) return;
    const dose = Number(novo.dose.replace(',', '.'));
    const via = novo.via as ViaAdministracao;
    const problemas = avaliarAdministracao({ medicamento: medSelecionado, dose, via, alergias: prontuario!.alergias });
    setAlertas(problemas);
    if (problemas.length) return;
    setMeds([...meds, { id: novoId(), medicamentoId: medSelecionado.id, dose, via, horario: new Date().toISOString() }]);
    setNovo({ medicamentoId: '', dose: '', via: '' });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const sinais: SinaisVitais = {};
    for (const c of CAMPOS_VITAIS) {
      const v = vitais[c.campo];
      sinais[c.campo] = v ? Number(v.replace(',', '.')) : null;
    }
    try {
      if (!classificacao) throw new Error('Escolha a classificação de risco.');
      const a = await salvarAtendimento({
        id: novoId(), pessoaId, prontuarioId: prontuario!.id, dataHora: new Date(dataHora).toISOString(), local: localOc,
        queixaPrincipal: queixa, observacoes, triagem: { protocolo, classificacao },
        glasgow: { ...glasgow, total: totalGlasgow }, sinaisVitais: sinais, medicamentos: meds, profissionalNome: sessao.assinatura(),
      });
      navegar(`/atendimento/${a.id}`);
    } catch (err) {
      setErros(mensagensDoErro(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const escalas = [
    { chave: 'ocular', rotulo: 'Abertura ocular', opcoes: GLASGOW_OCULAR },
    { chave: 'verbal', rotulo: 'Resposta verbal', opcoes: GLASGOW_VERBAL },
    { chave: 'motora', rotulo: 'Resposta motora', opcoes: GLASGOW_MOTORA },
  ] as const;

  return (
    <div className="mx-auto" style={{ maxWidth: 900 }}>
      {nova && <Etapas atual={2} />}
      <h1 className="h3 mb-1">Atendimento</h1>
      <p className="text-secondary mb-3">{pessoa.nome}</p>
      {prontuario.alergias.length > 0 && <div className="alergias mb-3"><i className="bi bi-exclamation-octagon-fill" />Alergias: {prontuario.alergias.join(', ')}</div>}
      <Erros lista={erros} />

      <form onSubmit={salvar} noValidate className="d-grid gap-3">
        <div className="card">
          <div className="card-header">Ocorrência</div>
          <div className="card-body row g-3">
            <div className="col-md-4"><label className="form-label" htmlFor="dh">Data e hora</label><input id="dh" type="datetime-local" className="form-control" value={dataHora} onChange={(e) => setDataHora(e.target.value)} /></div>
            <div className="col-md-8"><label className="form-label" htmlFor="local">Local</label><input id="local" className="form-control" value={localOc} onChange={(e) => setLocalOc(e.target.value)} placeholder="Rua, número, bairro, cidade" /></div>
            <div className="col-12"><label className="form-label" htmlFor="queixa">Queixa principal</label><input id="queixa" className="form-control" value={queixa} onChange={(e) => setQueixa(e.target.value)} placeholder="Ex.: dor torácica há 30 minutos" /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Classificação de risco</div>
          <div className="card-body">
            <div className="btn-group mb-3" role="group" aria-label="Protocolo">
              {(['START', 'MANCHESTER'] as const).map((p) => (
                <button key={p} type="button" className={`btn ${protocolo === p ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => { setProtocolo(p); setClassificacao(''); }}>{p === 'START' ? 'START' : 'Manchester'}</button>
              ))}
            </div>
            <div className="d-flex flex-wrap gap-2">
              {CLASSIFICACOES_POR_PROTOCOLO[protocolo].map((c) => (
                <span key={c}>
                  <input type="radio" className="btn-check" name="classificacao" id={`cl-${c}`} checked={classificacao === c} onChange={() => setClassificacao(c)} />
                  <label className="btn escolha-cor" data-cor={c} htmlFor={`cl-${c}`}>
                    <strong>{ROTULO_CLASSIFICACAO[c]}</strong><br /><small>{significadoClassificacao(protocolo, c)}</small>
                  </label>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex justify-content-between">Escala de Glasgow <span className="badge text-bg-light border fs-6">{totalGlasgow} · {glasgowGravidade(totalGlasgow)}</span></div>
          <div className="card-body row g-3">
            {escalas.map((e) => (
              <div key={e.chave} className="col-md-4">
                <label className="form-label" htmlFor={`gl-${e.chave}`}>{e.rotulo}</label>
                <select id={`gl-${e.chave}`} className="form-select" value={glasgow[e.chave]} onChange={(ev) => setGlasgow({ ...glasgow, [e.chave]: Number(ev.target.value) })}>
                  {e.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.valor} · {o.descricao}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Sinais vitais</div>
          <div className="card-body row g-3">
            {CAMPOS_VITAIS.map((c) => (
              <div key={c.campo} className="col-6 col-md-3">
                <label className="form-label small" htmlFor={`v-${c.campo}`}>{c.rotulo}</label>
                <div className="input-group">
                  <input id={`v-${c.campo}`} className="form-control" inputMode="decimal" value={vitais[c.campo] ?? ''} onChange={(e) => setVitais({ ...vitais, [c.campo]: e.target.value })} />
                  <span className="input-group-text small">{c.unidade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Medicamentos administrados</div>
          <div className="card-body">
            {meds.length > 0 && (
              <ul className="list-group mb-3">
                {meds.map((m) => (
                  <li key={m.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <span><i className="bi bi-capsule text-primary me-2" /><strong>{nomeMed(m.medicamentoId)}</strong> · {m.dose} {catalogo.find((x) => x.id === m.medicamentoId)?.unidade} · {m.via}</span>
                    <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => setMeds(meds.filter((x) => x.id !== m.id))} aria-label="Remover"><i className="bi bi-trash" /></button>
                  </li>
                ))}
              </ul>
            )}
            {catalogo.length === 0 ? (
              <p className="text-secondary small mb-0">Nenhum medicamento no aparelho. Use <strong>Receber dados</strong> estando online.</p>
            ) : (
              <div className="row g-2 align-items-end">
                <div className="col-md-5">
                  <label className="form-label small" htmlFor="med">Medicamento</label>
                  <select id="med" className="form-select" value={novo.medicamentoId} onChange={(e) => { setNovo({ medicamentoId: e.target.value, dose: '', via: '' }); setAlertas([]); }}>
                    <option value="">Escolha…</option>
                    {catalogo.map((m) => <option key={m.id} value={m.id}>{m.nome} · {m.apresentacao}</option>)}
                  </select>
                </div>
                <div className="col-5 col-md-3">
                  <label className="form-label small" htmlFor="dose">Dose{medSelecionado ? ` (máx. ${medSelecionado.doseMaxima} ${medSelecionado.unidade})` : ''}</label>
                  <div className="input-group">
                    <input id="dose" className="form-control" inputMode="decimal" value={novo.dose} onChange={(e) => setNovo({ ...novo, dose: e.target.value })} />
                    {medSelecionado && <span className="input-group-text">{medSelecionado.unidade}</span>}
                  </div>
                </div>
                <div className="col-4 col-md-2">
                  <label className="form-label small" htmlFor="via">Via</label>
                  <select id="via" className="form-select" value={novo.via} onChange={(e) => setNovo({ ...novo, via: e.target.value })}>
                    <option value="">—</option>
                    {(medSelecionado?.viasPermitidas ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="col-3 col-md-2 d-grid">
                  <button type="button" className="btn btn-outline-primary" onClick={adicionarMedicamento} disabled={!novo.medicamentoId || !novo.dose || !novo.via}>Adicionar</button>
                </div>
              </div>
            )}
            {alertas.length > 0 && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                <strong><i className="bi bi-shield-exclamation me-1" />Administração bloqueada</strong>
                <ul className="mb-0 ps-3">{alertas.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <label className="form-label" htmlFor="obs">Observações</label>
            <textarea id="obs" className="form-control" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light border" onClick={() => navegar(`/paciente/${pessoaId}`)}>Cancelar</button>
          <button type="submit" className="btn btn-primary btn-lg"><i className="bi bi-check2-circle me-1" />Salvar atendimento</button>
        </div>
      </form>
    </div>
  );
}
