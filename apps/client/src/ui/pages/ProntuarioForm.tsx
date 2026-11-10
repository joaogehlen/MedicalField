import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TIPOS_SANGUINEOS } from '@medicalfield/shared';
import { local } from '../../data/repositories';
import { novoId, salvarProntuario } from '../../services/registro';
import { Erros, Etapas, mensagensDoErro, Termos } from '../components';

export function ProntuarioForm() {
  const { id: pessoaId = '' } = useParams();
  const nova = useSearchParams()[0].get('nova') === '1';
  const navegar = useNavigate();
  const dados = useLiveQuery(async () => ({ pessoa: await local.pessoas.buscar(pessoaId), prontuario: await local.prontuarios.daPessoa(pessoaId) }), [pessoaId]);
  const [tipo, setTipo] = useState('');
  const [alergias, setAlergias] = useState<string[]>([]);
  const [comorbidades, setComorbidades] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => {
    const p = dados?.prontuario;
    if (!p) return;
    setTipo(p.tipoSanguineo ?? '');
    setAlergias(p.alergias);
    setComorbidades(p.comorbidades);
    setObservacoes(p.observacoes ?? '');
  }, [dados?.prontuario]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      await salvarProntuario({ id: dados?.prontuario?.id ?? novoId(), pessoaId, tipoSanguineo: tipo || null, alergias, comorbidades, observacoes });
      navegar(nova ? `/paciente/${pessoaId}/atendimento?nova=1` : `/paciente/${pessoaId}`);
    } catch (err) {
      setErros(mensagensDoErro(err));
    }
  }

  if (!dados) return null;
  return (
    <div className="mx-auto" style={{ maxWidth: 760 }}>
      {nova && <Etapas atual={1} />}
      <h1 className="h3 mb-1">Prontuário</h1>
      <p className="text-secondary mb-3">{dados.pessoa?.nome}</p>
      <Erros lista={erros} />
      <form className="card" onSubmit={salvar} noValidate>
        <div className="card-body d-grid gap-4">
          <div className="alert alert-light border mb-0 small"><i className="bi bi-shield-check text-primary me-1" />As alergias são conferidas antes de cada medicamento, mesmo sem conexão.</div>
          <Termos id="alergias" rotulo="Alergias" valor={alergias} onChange={setAlergias} sugestoes={['Dipirona', 'Penicilina', 'AAS', 'Látex', 'Iodo']} />
          <div>
            <label className="form-label" htmlFor="tipo">Tipo sanguíneo</label>
            <select id="tipo" className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Não informado</option>
              {TIPOS_SANGUINEOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Termos id="comorbidades" rotulo="Comorbidades" valor={comorbidades} onChange={setComorbidades} sugestoes={['Hipertensão arterial', 'Diabetes tipo 2', 'Asma', 'Insuficiência cardíaca']} />
          <div>
            <label className="form-label" htmlFor="obs">Observações</label>
            <textarea id="obs" className="form-control" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Marcapasso, gestação, prótese…" />
          </div>
        </div>
        <div className="card-footer bg-white d-flex justify-content-end gap-2 py-3">
          <button type="button" className="btn btn-light border" onClick={() => navegar(`/paciente/${pessoaId}`)}>Cancelar</button>
          <button type="submit" className="btn btn-primary">{nova ? 'Continuar' : 'Salvar'} <i className="bi bi-arrow-right" /></button>
        </div>
      </form>
    </div>
  );
}
