import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TIPOS_SANGUINEOS } from '@medicalfield/shared';
import { local } from '../../data/repositories';
import { novoId, salvarProntuario } from '../../services/registro';
import { errosPorCampo, ResumoErros } from '../components/Erros';
import { Etapas } from '../components/Etapas';
import { Termos } from '../components/Termos';

const ALERGIAS = ['Dipirona', 'Penicilina', 'AAS', 'Látex', 'Iodo', 'Frutos do mar'];
const COMORBIDADES = ['Hipertensão arterial', 'Diabetes tipo 2', 'Asma', 'DPOC', 'Insuficiência cardíaca', 'Epilepsia'];

export function ProntuarioForm() {
  const { id: pessoaId = '' } = useParams();
  const [params] = useSearchParams();
  const fluxo = params.get('fluxo') === 'nova';
  const navegar = useNavigate();
  const dados = useLiveQuery(async () => ({
    pessoa: await local.pessoas.buscar(pessoaId),
    prontuario: await local.prontuarios.daPessoa(pessoaId),
  }), [pessoaId]);

  const [tipo, setTipo] = useState<string | null>(null);
  const [alergias, setAlergias] = useState<string[]>([]);
  const [comorbidades, setComorbidades] = useState<string[]>([]);
  const [usoContinuo, setUsoContinuo] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const p = dados?.prontuario;
    if (!p) return;
    setTipo(p.tipoSanguineo ?? null);
    setAlergias(p.alergias);
    setComorbidades(p.comorbidades);
    setUsoContinuo(p.medicamentosUsoContinuo);
    setObservacoes(p.observacoes ?? '');
  }, [dados?.prontuario]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await salvarProntuario({
        id: dados?.prontuario?.id ?? novoId(),
        pessoaId,
        tipoSanguineo: tipo,
        alergias,
        comorbidades,
        medicamentosUsoContinuo: usoContinuo,
        observacoes,
      });
      navegar(fluxo ? `/paciente/${pessoaId}/atendimento/novo?fluxo=nova` : `/paciente/${pessoaId}`);
    } catch (err) {
      setErros(errosPorCampo(err));
    } finally {
      setSalvando(false);
    }
  }

  if (!dados) return null;
  return (
    <div className="pagina pagina-form">
      {fluxo && <Etapas atual={1} />}
      <h1>Prontuário de {dados.pessoa?.nome ?? 'paciente'}</h1>
      <form onSubmit={salvar} className="form-pilha" noValidate>
        <ResumoErros erros={erros} />

        <Termos
          rotulo="Alergias"
          valor={alergias}
          onChange={setAlergias}
          sugestoes={ALERGIAS}
          placeholder="Digite e tecle Enter"
          ajuda="As alergias são checadas antes de qualquer medicamento — mesmo sem conexão."
        />

        <fieldset className="segmentos">
          <legend>Tipo sanguíneo <span className="opcional">(se informado)</span></legend>
          {TIPOS_SANGUINEOS.map((t) => (
            <label key={t} className="segmento">
              <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} />
              <span>{t}</span>
            </label>
          ))}
          <label className="segmento">
            <input type="radio" name="tipo" checked={tipo === null} onChange={() => setTipo(null)} />
            <span>Não sabe</span>
          </label>
        </fieldset>

        <Termos rotulo="Comorbidades" valor={comorbidades} onChange={setComorbidades} sugestoes={COMORBIDADES} placeholder="Ex.: Hipertensão arterial" />
        <Termos rotulo="Medicamentos de uso contínuo" valor={usoContinuo} onChange={setUsoContinuo} placeholder="Ex.: Losartana 50 mg" />

        <div className="campo">
          <label htmlFor="obs">Observações <span className="opcional">(opcional)</span></label>
          <textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Marcapasso, gestação, prótese…" />
        </div>

        <div className="barra-acoes">
          <button type="button" className="btn btn-grande" onClick={() => navegar(`/paciente/${pessoaId}`)}>
            {fluxo ? 'Depois' : 'Cancelar'}
          </button>
          <button type="submit" className="btn btn-primario btn-grande" data-carregando={salvando}>
            {fluxo ? 'Continuar para o atendimento' : 'Salvar prontuário'}
          </button>
        </div>
      </form>
    </div>
  );
}
