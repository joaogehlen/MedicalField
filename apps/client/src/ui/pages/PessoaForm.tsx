import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Sexo } from '@medicalfield/shared';
import { local } from '../../data/repositories';
import { novoId, salvarPessoa } from '../../services/registro';
import { Erros, Etapas, mensagensDoErro } from '../components';

const VAZIO = { nome: '', cpf: '', dataNascimento: '', sexo: '' as Sexo | '', telefone: '', email: '', contatoNome: '', contatoEmail: '' };

export function PessoaForm() {
  const { id } = useParams();
  const navegar = useNavigate();
  const existente = useLiveQuery(async () => (id ? await local.pessoas.buscar(id) : undefined), [id]);
  const [f, setF] = useState(VAZIO);
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => {
    if (existente) {
      setF({
        nome: existente.nome, cpf: existente.cpf ?? '', dataNascimento: existente.dataNascimento ?? '', sexo: existente.sexo ?? '',
        telefone: existente.telefone ?? '', email: existente.email ?? '', contatoNome: existente.contatoNome ?? '', contatoEmail: existente.contatoEmail ?? '',
      });
    }
  }, [existente]);

  const campo = (k: keyof typeof VAZIO) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      const p = await salvarPessoa({ id: id ?? novoId(), ...f, sexo: f.sexo || null });
      navegar(id ? `/paciente/${p.id}` : `/paciente/${p.id}/prontuario?nova=1`);
    } catch (err) {
      setErros(mensagensDoErro(err));
    }
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 760 }}>
      {!id && <Etapas atual={0} />}
      <h1 className="h3 mb-3">{id ? 'Dados do paciente' : 'Quem é a vítima?'}</h1>
      <Erros lista={erros} />
      <form className="card" onSubmit={salvar} noValidate>
        <div className="card-body row g-3">
          <div className="col-12"><label className="form-label" htmlFor="nome">Nome</label><input id="nome" className="form-control form-control-lg" {...campo('nome')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="cpf">CPF <span className="text-secondary fw-normal">(opcional)</span></label><input id="cpf" className="form-control font-monospace" inputMode="numeric" placeholder="000.000.000-00" {...campo('cpf')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="nasc">Data de nascimento</label><input id="nasc" type="date" className="form-control" {...campo('dataNascimento')} /></div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="sexo">Sexo</label>
            <select id="sexo" className="form-select" {...campo('sexo')}>
              <option value="">Não informado</option><option value="M">Masculino</option><option value="F">Feminino</option><option value="O">Outro</option>
            </select>
          </div>
          <div className="col-md-6"><label className="form-label" htmlFor="tel">Telefone</label><input id="tel" type="tel" className="form-control" {...campo('telefone')} /></div>
          <div className="col-12"><label className="form-label" htmlFor="email">E-mail do paciente</label><input id="email" type="email" className="form-control" {...campo('email')} /></div>
          <div className="col-12"><hr className="my-1" /><p className="small text-secondary mb-0">Familiar ou acompanhante (recebe a ficha por e-mail)</p></div>
          <div className="col-md-6"><label className="form-label" htmlFor="cnome">Nome do contato</label><input id="cnome" className="form-control" {...campo('contatoNome')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="cemail">E-mail do contato</label><input id="cemail" type="email" className="form-control" {...campo('contatoEmail')} /></div>
        </div>
        <div className="card-footer bg-white d-flex justify-content-end gap-2 py-3">
          <button type="button" className="btn btn-light border" onClick={() => navegar(-1)}>Cancelar</button>
          <button type="submit" className="btn btn-primary">{id ? 'Salvar' : 'Continuar'} <i className="bi bi-arrow-right" /></button>
        </div>
      </form>
    </div>
  );
}
