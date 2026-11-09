import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CLASSIFICACOES, INFO_CLASSIFICACAO, type AtendimentoResumo, type Page } from '@medicalfield/shared';
import { useApi, useProfissionais } from '../api';
import { Cabeca, Carregando, Erro, Paginacao, SeloOffline, TagTriagem } from '../components/ui';
import { fmtDataHora } from '../format';

export function Atendimentos() {
  const navegar = useNavigate();
  const nome = useProfissionais();
  const [busca, setBusca] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [status, setStatus] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [pagina, setPagina] = useState(1);
  const q = new URLSearchParams({ pagina: String(pagina), tamanho: '25' });
  if (busca.trim()) q.set('busca', busca.trim());
  if (classificacao) q.set('classificacao', classificacao);
  if (status) q.set('status', status);
  if (de) q.set('de', new Date(`${de}T00:00:00`).toISOString());
  if (ate) q.set('ate', new Date(`${ate}T23:59:59`).toISOString());
  const { dados, erro, carregando, recarregar } = useApi<Page<AtendimentoResumo>>(`/atendimento?${q}`);
  const filtrar = (f: () => void) => {
    f();
    setPagina(1);
  };
  const filtrando = !!(busca || classificacao || status || de || ate);

  return (
    <div className="pagina">
      <Cabeca titulo="Atendimentos" sub={dados ? `${dados.total} registrados na central` : undefined} onAtualizar={() => void recarregar()} carregando={carregando} />

      <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="campo busca">
          <label htmlFor="f-busca">Buscar</label>
          <Search aria-hidden />
          <input id="f-busca" type="search" placeholder="Paciente, queixa ou local" value={busca} onChange={(e) => filtrar(() => setBusca(e.target.value))} />
        </div>
        <div className="campo">
          <label htmlFor="f-class">Classificação</label>
          <select id="f-class" value={classificacao} onChange={(e) => filtrar(() => setClassificacao(e.target.value))}>
            <option value="">Todas</option>
            {CLASSIFICACOES.map((c) => <option key={c} value={c}>{INFO_CLASSIFICACAO[c].rotulo}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-status">Situação</label>
          <select id="f-status" value={status} onChange={(e) => filtrar(() => setStatus(e.target.value))}>
            <option value="">Todas</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="RASCUNHO">Em andamento</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-de">De</label>
          <input id="f-de" type="date" className="mono" value={de} onChange={(e) => filtrar(() => setDe(e.target.value))} />
        </div>
        <div className="campo">
          <label htmlFor="f-ate">Até</label>
          <input id="f-ate" type="date" className="mono" value={ate} onChange={(e) => filtrar(() => setAte(e.target.value))} />
        </div>
      </form>

      {erro && <Erro mensagem={erro} />}
      {!dados ? (
        <Carregando />
      ) : dados.itens.length === 0 ? (
        <div className="vazio">
          <strong>{filtrando ? 'Nenhum atendimento com esses filtros.' : 'Nenhum atendimento recebido ainda.'}</strong>
          <p>{filtrando ? 'Amplie o período ou limpe a busca.' : 'Os atendimentos aparecem aqui assim que as equipes sincronizam os dispositivos.'}</p>
        </div>
      ) : (
        <>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Triagem</th>
                  <th>Paciente</th>
                  <th>Queixa principal</th>
                  <th>Início</th>
                  <th>Local</th>
                  <th>Registrado por</th>
                  <th>Recebido</th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((a) => (
                  <tr key={a.id} data-link onClick={() => navegar(`/atendimentos/${a.id}`)}>
                    <td><TagTriagem triagem={a.triagem} /></td>
                    <td>
                      <a href={`/portal/atendimentos/${a.id}`} onClick={(e) => { e.preventDefault(); navegar(`/atendimentos/${a.id}`); }} className="link-linha">{a.pessoaNome}</a>
                      {a.status === 'RASCUNHO' && <div className="fraco">Em andamento</div>}
                    </td>
                    <td>{a.queixaPrincipal}</td>
                    <td className="mono">{fmtDataHora(a.iniciadoEm)}</td>
                    <td className="truncar" title={a.localDescricao}>{a.localDescricao}</td>
                    <td>{nome(a.registradoPor)}</td>
                    <td>
                      <div className="mono">{fmtDataHora(a.sincronizadoEm)}</div>
                      {a.criadoOffline && <SeloOffline />}
                    </td>
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
