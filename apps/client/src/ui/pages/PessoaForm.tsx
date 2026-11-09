import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cpfValido, somenteDigitos, type Pessoa, type Sexo } from '@medicalfield/shared';
import { local } from '../../data/repositories';
import { novoId, salvarPessoa } from '../../services/registro';
import { errosPorCampo, ResumoErros } from '../components/Erros';
import { Etapas } from '../components/Etapas';

type Form = {
  identificada: boolean;
  nome: string;
  cpf: string;
  dataNascimento: string;
  sexo: Sexo | '';
  telefone: string;
  email: string;
  contatoNome: string;
  contatoParentesco: string;
  contatoTelefone: string;
  contatoEmail: string;
  caracteristicas: string;
};

const vazio: Form = {
  identificada: true,
  nome: '',
  cpf: '',
  dataNascimento: '',
  sexo: '',
  telefone: '',
  email: '',
  contatoNome: '',
  contatoParentesco: '',
  contatoTelefone: '',
  contatoEmail: '',
  caracteristicas: '',
};

const deRegistro = (p: Pessoa): Form => ({
  identificada: p.identificada,
  nome: p.nome,
  cpf: p.cpf ?? '',
  dataNascimento: p.dataNascimento ?? '',
  sexo: p.sexo ?? '',
  telefone: p.telefone ?? '',
  email: p.email ?? '',
  contatoNome: p.contatoNome ?? '',
  contatoParentesco: p.contatoParentesco ?? '',
  contatoTelefone: p.contatoTelefone ?? '',
  contatoEmail: p.contatoEmail ?? '',
  caracteristicas: p.caracteristicas ?? '',
});

export function PessoaForm() {
  const { id } = useParams();
  const editando = !!id;
  const navegar = useNavigate();
  const existente = useLiveQuery(async () => (id ? await local.pessoas.buscar(id) : undefined), [id]);
  const [f, setF] = useState<Form>(vazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (existente) setF(deRegistro(existente));
  }, [existente]);

  // Mesma vítima já cadastrada neste aparelho (pelo CPF)?
  const cpf = somenteDigitos(f.cpf);
  const duplicada = useLiveQuery(
    async () => (cpf.length === 11 && cpfValido(cpf) ? (await local.pessoas.listar()).find((p) => p.cpf === cpf && p.id !== id) : undefined),
    [cpf, id],
  );

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const pessoa = await salvarPessoa({
        id: id ?? novoId(),
        nome: f.identificada ? f.nome : f.nome.trim() || 'Desconhecido',
        identificada: f.identificada,
        cpf: f.identificada ? f.cpf : null,
        dataNascimento: f.dataNascimento || null,
        sexo: f.sexo || null,
        telefone: f.telefone,
        email: f.email,
        contatoNome: f.contatoNome,
        contatoParentesco: f.contatoParentesco,
        contatoTelefone: f.contatoTelefone,
        contatoEmail: f.contatoEmail,
        caracteristicas: f.identificada ? f.caracteristicas || null : f.caracteristicas,
      });
      navegar(editando ? `/paciente/${pessoa.id}` : `/paciente/${pessoa.id}/prontuario?fluxo=nova`);
    } catch (err) {
      setErros(errosPorCampo(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvando(false);
    }
  }

  const erro = (k: string) => erros[k] && <span className="erro-campo">{erros[k]}</span>;

  return (
    <div className="pagina pagina-form">
      {!editando && <Etapas atual={0} />}
      <h1>{editando ? 'Editar dados da vítima' : 'Quem é a vítima?'}</h1>
      <form onSubmit={salvar} noValidate className="form-pilha">
        <ResumoErros erros={erros} />

        <fieldset className="segmentos">
          <legend>Identificação</legend>
          <label className="segmento">
            <input type="radio" name="ident" checked={f.identificada} onChange={() => set('identificada', true)} />
            <span>Identificada</span>
          </label>
          <label className="segmento">
            <input type="radio" name="ident" checked={!f.identificada} onChange={() => set('identificada', false)} />
            <span>Não identificada</span>
          </label>
        </fieldset>

        <div className="campo">
          <label htmlFor="nome">Nome {!f.identificada && <span className="opcional">(opcional — fica “Desconhecido”)</span>}</label>
          <input id="nome" value={f.nome} onChange={(e) => set('nome', e.target.value)} autoComplete="off" aria-invalid={!!erros.nome} />
          {erro('nome')}
        </div>

        {f.identificada && (
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="cpf">CPF <span className="opcional">(opcional)</span></label>
              <input id="cpf" className="mono" inputMode="numeric" value={f.cpf} onChange={(e) => set('cpf', e.target.value)} aria-invalid={!!erros.cpf} placeholder="000.000.000-00" />
              {erro('cpf')}
            </div>
            <div className="campo">
              <label htmlFor="nasc">Data de nascimento <span className="opcional">(opcional)</span></label>
              <input id="nasc" type="date" className="mono" value={f.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} />
            </div>
          </div>
        )}

        {duplicada && (
          <div className="alerta alerta-aviso" role="status">
            <span aria-hidden>!</span>
            <p>
              <strong>{duplicada.nome}</strong> já tem este CPF neste aparelho.{' '}
              <button type="button" className="link" onClick={() => navegar(`/paciente/${duplicada.id}`)}>
                Abrir o paciente existente
              </button>
            </p>
          </div>
        )}

        {!f.identificada && (
          <div className="campo">
            <label htmlFor="carac">Características da vítima</label>
            <textarea id="carac" value={f.caracteristicas} onChange={(e) => set('caracteristicas', e.target.value)} aria-invalid={!!erros.caracteristicas} placeholder="Sexo aparente, idade estimada, roupas, tatuagens, objetos pessoais…" />
            {erro('caracteristicas')}
          </div>
        )}

        <fieldset className="segmentos">
          <legend>Sexo <span className="opcional">(opcional)</span></legend>
          {(['M', 'F', 'O'] as const).map((s) => (
            <label key={s} className="segmento">
              <input type="radio" name="sexo" checked={f.sexo === s} onChange={() => set('sexo', s)} />
              <span>{s === 'M' ? 'Masculino' : s === 'F' ? 'Feminino' : 'Outro'}</span>
            </label>
          ))}
        </fieldset>

        {f.identificada && (
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="tel">Telefone <span className="opcional">(opcional)</span></label>
              <input id="tel" type="tel" className="mono" value={f.telefone} onChange={(e) => set('telefone', e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="email">E-mail <span className="opcional">(para enviar a ficha)</span></label>
              <input id="email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!erros.email} />
              {erro('email')}
            </div>
          </div>
        )}

        <fieldset className="grupo">
          <legend>Contato responsável <span className="opcional">(familiar ou acompanhante)</span></legend>
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="cnome">Nome</label>
              <input id="cnome" value={f.contatoNome} onChange={(e) => set('contatoNome', e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="cpar">Parentesco</label>
              <input id="cpar" value={f.contatoParentesco} onChange={(e) => set('contatoParentesco', e.target.value)} placeholder="Esposa, filho, vizinho…" />
            </div>
            <div className="campo">
              <label htmlFor="ctel">Telefone</label>
              <input id="ctel" type="tel" className="mono" value={f.contatoTelefone} onChange={(e) => set('contatoTelefone', e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="cemail">E-mail</label>
              <input id="cemail" type="email" value={f.contatoEmail} onChange={(e) => set('contatoEmail', e.target.value)} aria-invalid={!!erros.contatoEmail} />
              {erro('contatoEmail')}
            </div>
          </div>
        </fieldset>

        <div className="barra-acoes">
          <button type="button" className="btn btn-grande" onClick={() => navegar(-1)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario btn-grande" data-carregando={salvando}>
            {editando ? 'Salvar' : 'Continuar para o prontuário'}
          </button>
        </div>
      </form>
    </div>
  );
}
