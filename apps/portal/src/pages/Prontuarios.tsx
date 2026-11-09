import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AtendimentoResumo, Page, Pessoa, ProntuarioResumo } from '@medicalfield/shared';
import { useApi } from '../api';
import { Cabeca, Carregando, Erro, Paginacao, SeloOffline, TagTriagem } from '../components/ui';
import { fmtCpf, fmtData, fmtDataHora, idade } from '../format';

export function Prontuarios() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const q = new URLSearchParams({ pagina: String(pagina), tamanho: '25' });
  if (busca.trim()) q.set('busca', busca.trim());
  const { dados, erro, carregando, recarregar } = useApi<Page<ProntuarioResumo>>(`/prontuario?${q}`);

  return (
    <div className="pagina">
      <Cabeca titulo="Prontuários" sub={dados ? `${dados.total} pacientes` : undefined} onAtualizar={() => void recarregar()} carregando={carregando} />
      <div className="filtros">
        <div className="campo busca">
          <label htmlFor="p-busca">Buscar</label>
          <Search aria-hidden />
          <input id="p-busca" type="search" placeholder="Nome ou CPF" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
        </div>
      </div>
      {erro && <Erro mensagem={erro} />}
      {!dados ? <Carregando /> : dados.itens.length === 0 ? (
        <div className="vazio"><strong>{busca ? 'Nenhum prontuário encontrado.' : 'Nenhum prontuário recebido ainda.'}</strong><p>Os prontuários abertos pelas equipes aparecem aqui após a sincronização.</p></div>
      ) : (
        <>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Paciente</th><th>CPF</th><th>Idade</th><th>Tipo sang.</th><th>Alergias</th><th>Comorbidades</th><th className="num">Atendimentos</th><th>Atualizado</th></tr></thead>
              <tbody>
                {dados.itens.map((p) => (
                  <tr key={p.id} data-link onClick={() => navegar(`/prontuarios/${p.id}`)}>
                    <td>
                      <a href={`/portal/prontuarios/${p.id}`} className="link-linha" onClick={(e) => { e.preventDefault(); navegar(`/prontuarios/${p.id}`); }}>{p.pessoa.nome}</a>
                      {p.criadoOffline && <div><SeloOffline /></div>}
                    </td>
                    <td className="mono">{p.pessoa.identificada ? fmtCpf(p.pessoa.cpf) : 'Não identificado'}</td>
                    <td>{idade(p.pessoa.dataNascimento) ?? '—'}</td>
                    <td>{p.tipoSanguineo ?? '—'}</td>
                    <td>{p.alergias.length ? <span className="alergia-inline">{p.alergias.join(', ')}</span> : <span className="fraco">Nenhuma</span>}</td>
                    <td className="truncar">{p.comorbidades.join(', ') || '—'}</td>
                    <td className="num mono">{p.totalAtendimentos}</td>
                    <td className="mono">{fmtDataHora(p.sincronizadoEm ?? p.atualizadoEmCliente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao page={dados} onPagina={setPagina} />
        </>
      )}
    </div>
  );
}

const SEXO = { M: 'Masculino', F: 'Feminino', O: 'Outro' } as const;

export function ProntuarioDetalhe() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const pr = useApi<ProntuarioResumo>(`/prontuario/${id}`);
  const pessoa = useApi<Pessoa>(pr.dados ? `/pessoa/${pr.dados.pessoaId}` : null);
  const atend = useApi<AtendimentoResumo[]>(pr.dados ? `/atendimento/${pr.dados.pessoaId}` : null);

  if (pr.erro) return <div className="pagina"><Erro mensagem={pr.erro} /></div>;
  if (!pr.dados || !pessoa.dados) return <div className="pagina"><Carregando linhas={8} /></div>;
  const p = pr.dados;
  const pe = pessoa.dados;

  return (
    <div className="pagina">
      <Link to="/prontuarios" className="voltar"><ArrowLeft aria-hidden /> Prontuários</Link>
      <div className="pagina-cabeca">
        <div>
          <h1>{pe.nome}</h1>
          <p className="subtitulo"><span className="mono">{pe.identificada ? fmtCpf(pe.cpf) : 'Vítima não identificada'}</span>{idade(pe.dataNascimento) ? ` · ${idade(pe.dataNascimento)}` : ''}</p>
        </div>
        {p.criadoOffline && <SeloOffline />}
      </div>
      {p.alergias.length > 0 ? <div className="alergias"><b>Alergias</b> {p.alergias.join(' · ')}</div> : <p className="nota">Nenhuma alergia registrada.</p>}
      <div className="duas-colunas">
        <section className="painel bloco">
          <div className="secao-titulo"><h2>Identificação</h2></div>
          <dl className="dados">
            <div><dt>Nascimento</dt><dd className="mono">{fmtData(pe.dataNascimento)}</dd></div>
            <div><dt>Sexo</dt><dd>{pe.sexo ? SEXO[pe.sexo] : '—'}</dd></div>
            <div><dt>Telefone</dt><dd className="mono">{pe.telefone ?? '—'}</dd></div>
            <div><dt>E-mail</dt><dd>{pe.email ?? '—'}</dd></div>
            <div className="largo"><dt>Contato responsável</dt><dd>{[pe.contatoNome, pe.contatoParentesco, pe.contatoTelefone, pe.contatoEmail].filter(Boolean).join(' · ') || '—'}</dd></div>
            {pe.caracteristicas && <div className="largo"><dt>Características</dt><dd>{pe.caracteristicas}</dd></div>}
          </dl>
        </section>
        <section className="painel bloco">
          <div className="secao-titulo"><h2>Prontuário</h2><span className="fraco mono">versão {p.version}</span></div>
          <dl className="dados">
            <div><dt>Tipo sanguíneo</dt><dd>{p.tipoSanguineo ?? '—'}</dd></div>
            <div><dt>Comorbidades</dt><dd>{p.comorbidades.join(', ') || '—'}</dd></div>
            <div className="largo"><dt>Uso contínuo</dt><dd>{p.medicamentosUsoContinuo.join(', ') || '—'}</dd></div>
            {p.observacoes && <div className="largo"><dt>Observações</dt><dd>{p.observacoes}</dd></div>}
          </dl>
        </section>
      </div>
      <section>
        <h2 className="grupo-titulo">Atendimentos</h2>
        {!atend.dados ? <Carregando linhas={2} /> : atend.dados.length === 0 ? <p className="nota">Nenhum atendimento.</p> : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Triagem</th><th>Queixa</th><th>Início</th><th>Local</th><th>Situação</th></tr></thead>
              <tbody>
                {atend.dados.map((a) => (
                  <tr key={a.id} data-link onClick={() => navegar(`/atendimentos/${a.id}`)}>
                    <td><TagTriagem triagem={a.triagem} /></td>
                    <td>{a.queixaPrincipal}</td>
                    <td className="mono">{fmtDataHora(a.iniciadoEm)}</td>
                    <td className="truncar">{a.localDescricao}</td>
                    <td>{a.status === 'FINALIZADO' ? 'Finalizado' : 'Em andamento'}{a.criadoOffline && <> <SeloOffline /></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
