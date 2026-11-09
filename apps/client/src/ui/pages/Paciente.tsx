import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, FilePlus2, Pencil } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { local } from '../../data/repositories';
import { SeloOffline, SeloSync } from '../components/Selos';
import { TagTriagem } from '../components/Triagem';
import { fmtCpf, fmtData, fmtDataHora, idade } from '../format';

const SEXO = { M: 'Masculino', F: 'Feminino', O: 'Outro' } as const;

export function Paciente() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const dados = useLiveQuery(async () => {
    const pessoa = await local.pessoas.buscar(id);
    if (!pessoa) return { pessoa: null };
    const [prontuario, atendimentos] = await Promise.all([local.prontuarios.daPessoa(pessoa.mescladaEm ?? id), local.atendimentos.daPessoa(pessoa.mescladaEm ?? id)]);
    return { pessoa, prontuario, atendimentos };
  }, [id]);

  if (!dados) return <div className="pagina"><div className="esqueleto" style={{ height: 200 }} /></div>;
  if (!dados.pessoa) return <div className="pagina"><div className="vazio"><strong>Paciente não encontrado neste aparelho.</strong></div></div>;
  const { pessoa, prontuario, atendimentos = [] } = dados;

  return (
    <div className="pagina">
      <div className="pagina-cabeca">
        <div>
          <h1>{pessoa.nome}</h1>
          <p className="subtitulo">
            {pessoa.identificada ? <span className="mono">{fmtCpf(pessoa.cpf)}</span> : 'Vítima não identificada'}
            {idade(pessoa.dataNascimento) && ` · ${idade(pessoa.dataNascimento)}`}
          </p>
        </div>
        <SeloSync status={pessoa.syncStatus} erro={pessoa.syncErro} />
      </div>

      {prontuario ? (
        prontuario.alergias.length > 0 ? (
          <div className="alergias">
            <b>Alergias</b> {prontuario.alergias.join(' · ')}
          </div>
        ) : (
          <p className="nota">Nenhuma alergia registrada.</p>
        )
      ) : null}

      <div className="acoes-principais">
        {prontuario ? (
          <button type="button" className="btn btn-primario btn-grande" onClick={() => navegar(`/paciente/${pessoa.id}/atendimento/novo`)}>
            <FilePlus2 aria-hidden /> Novo atendimento
          </button>
        ) : (
          <button type="button" className="btn btn-primario btn-grande" onClick={() => navegar(`/paciente/${pessoa.id}/prontuario`)}>
            <FilePlus2 aria-hidden /> Abrir prontuário
          </button>
        )}
      </div>

      <section className="painel bloco">
        <div className="secao-titulo">
          <h2>Identificação</h2>
          <Link to={`/paciente/${pessoa.id}/editar`} className="btn btn-fantasma">
            <Pencil aria-hidden /> Editar
          </Link>
        </div>
        <dl className="dados">
          <div><dt>Nascimento</dt><dd className="mono">{fmtData(pessoa.dataNascimento)}</dd></div>
          <div><dt>Sexo</dt><dd>{pessoa.sexo ? SEXO[pessoa.sexo] : '—'}</dd></div>
          <div><dt>Telefone</dt><dd className="mono">{pessoa.telefone ?? '—'}</dd></div>
          <div><dt>E-mail</dt><dd>{pessoa.email ?? '—'}</dd></div>
          <div><dt>Contato</dt><dd>{[pessoa.contatoNome, pessoa.contatoParentesco].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt>Telefone do contato</dt><dd className="mono">{pessoa.contatoTelefone ?? '—'}</dd></div>
          {pessoa.caracteristicas && <div className="largo"><dt>Características</dt><dd>{pessoa.caracteristicas}</dd></div>}
        </dl>
      </section>

      {prontuario && (
        <section className="painel bloco">
          <div className="secao-titulo">
            <h2>Prontuário</h2>
            <Link to={`/paciente/${pessoa.id}/prontuario`} className="btn btn-fantasma">
              <Pencil aria-hidden /> Editar
            </Link>
          </div>
          <dl className="dados">
            <div><dt>Tipo sanguíneo</dt><dd>{prontuario.tipoSanguineo ?? '—'}</dd></div>
            <div><dt>Comorbidades</dt><dd>{prontuario.comorbidades.join(', ') || '—'}</dd></div>
            <div><dt>Uso contínuo</dt><dd>{prontuario.medicamentosUsoContinuo.join(', ') || '—'}</dd></div>
            {prontuario.observacoes && <div className="largo"><dt>Observações</dt><dd>{prontuario.observacoes}</dd></div>}
          </dl>
        </section>
      )}

      <section>
        <h2 className="grupo-titulo">Atendimentos</h2>
        {atendimentos.length === 0 ? (
          <p className="nota">Nenhum atendimento registrado para este paciente.</p>
        ) : (
          <ul className="lista-ocorrencias">
            {atendimentos.map((a) => (
              <li key={a.id}>
                <Link to={`/atendimento/${a.id}`} className="ocorrencia">
                  <TagTriagem triagem={a.triagem} />
                  <div className="ocorrencia-texto">
                    <strong>{a.queixaPrincipal}</strong>
                    <span className="mono">{fmtDataHora(a.iniciadoEm)}</span>
                  </div>
                  <div className="ocorrencia-meta">
                    <div className="selos">
                      {a.criadoOffline && <SeloOffline />}
                      <SeloSync status={a.syncStatus} erro={a.syncErro} />
                    </div>
                  </div>
                  <ChevronRight aria-hidden className="seta" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
