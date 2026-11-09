import { useState } from 'react';
import type { AccessLog, LogClienteRegistro, Page, SyncConflito } from '@medicalfield/shared';
import { useApi, useProfissionais } from '../api';
import { Cabeca, Carregando, Erro, Paginacao } from '../components/ui';
import { fmtDataHora } from '../format';

const SERVICOS = [
  { id: 'clinical', rotulo: 'clinical-service · TypeScript', rota: '/clinico/access-log' },
  { id: 'identity', rotulo: 'identity-service · Java', rota: '/access-log' },
  { id: 'document', rotulo: 'document-service · Python', rota: '/ficha/access-log' },
] as const;

const ROTULO_ACAO: Record<string, string> = {
  LOGIN_OFFLINE: 'Login offline', LOGIN_ONLINE: 'Login online', REDE_ALTERADA: 'Rede alterada', PESSOA_CRIADA: 'Vítima registrada',
  PESSOA_ALTERADA: 'Vítima alterada', PRONTUARIO_CRIADO: 'Prontuário aberto', PRONTUARIO_ALTERADO: 'Prontuário alterado',
  ATENDIMENTO_CRIADO: 'Atendimento iniciado', ATENDIMENTO_ALTERADO: 'Atendimento alterado', ATENDIMENTO_FINALIZADO: 'Atendimento finalizado',
  ALERTA_CLINICO_EXIBIDO: 'Alerta clínico exibido', ALERTA_CLINICO_IGNORADO: 'Alerta clínico justificado', SINCRONIZACAO_CONCLUIDA: 'Sincronização',
  ERRO_SINCRONIZACAO: 'Erro de sincronização',
};

export function Auditoria() {
  const [aba, setAba] = useState<'acessos' | 'dispositivos' | 'conflitos'>('acessos');
  return (
    <div className="pagina">
      <Cabeca titulo="Auditoria" sub="Log de acesso de cada serviço (LGPD), ações registradas nos dispositivos e conflitos resolvidos na sincronização." />
      <div className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'acessos'} onClick={() => setAba('acessos')}>Acessos às APIs</button>
        <button type="button" role="tab" aria-selected={aba === 'dispositivos'} onClick={() => setAba('dispositivos')}>Ações nos dispositivos</button>
        <button type="button" role="tab" aria-selected={aba === 'conflitos'} onClick={() => setAba('conflitos')}>Conflitos</button>
      </div>
      {aba === 'acessos' && <Acessos />}
      {aba === 'dispositivos' && <Dispositivos />}
      {aba === 'conflitos' && <Conflitos />}
    </div>
  );
}

function Acessos() {
  const nome = useProfissionais();
  const [servico, setServico] = useState<(typeof SERVICOS)[number]>(SERVICOS[0]);
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, recarregar } = useApi<Page<AccessLog>>(`${servico.rota}?pagina=${pagina}&tamanho=50`);
  return (
    <>
      <div className="barra-tabela">
        <div className="campo campo-inline">
          <label htmlFor="a-serv">Serviço</label>
          <select id="a-serv" value={servico.id} onChange={(e) => { setServico(SERVICOS.find((s) => s.id === e.target.value)!); setPagina(1); }}>
            {SERVICOS.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
          </select>
        </div>
        <button type="button" className="btn" onClick={() => void recarregar()} data-carregando={carregando}>Atualizar</button>
      </div>
      {erro && <Erro mensagem={erro} />}
      {!dados ? <Carregando /> : (
        <>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Data/hora</th><th>IP do cliente</th><th>Profissional</th><th>Método</th><th>Rota</th><th className="num">Status</th><th className="num">Tempo</th></tr></thead>
              <tbody>
                {dados.itens.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{fmtDataHora(l.dataHora)}</td>
                    <td className="mono">{l.ipCliente ?? '—'}</td>
                    <td>{l.profissionalId ? nome(l.profissionalId) : <span className="fraco">não autenticado</span>}</td>
                    <td className="mono">{l.metodo}</td>
                    <td className="mono truncar" title={l.caminho}>{l.rota}</td>
                    <td className="num mono"><span className={`status s${String(l.statusCode)[0]}`}>{l.statusCode}</span></td>
                    <td className="num mono">{l.tempoMs.toFixed(1)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao page={dados} onPagina={setPagina} />
        </>
      )}
    </>
  );
}

function Dispositivos() {
  const nome = useProfissionais();
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, recarregar } = useApi<Page<LogClienteRegistro>>(`/log?pagina=${pagina}&tamanho=50`);
  return (
    <>
      <div className="barra-tabela">
        <span className="fraco">Enviados pelos aparelhos em POST /log — inclusive o que aconteceu sem conexão.</span>
        <button type="button" className="btn" onClick={() => void recarregar()} data-carregando={carregando}>Atualizar</button>
      </div>
      {erro && <Erro mensagem={erro} />}
      {!dados ? <Carregando /> : dados.itens.length === 0 ? <div className="vazio"><strong>Nenhum log de dispositivo recebido.</strong></div> : (
        <>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Quando (no aparelho)</th><th>Ação</th><th>Profissional</th><th>Dispositivo</th><th>Conexão</th><th>Recebido</th></tr></thead>
              <tbody>
                {dados.itens.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{fmtDataHora(l.dataHora)}</td>
                    <td><span className={l.nivel === 'INFO' ? '' : 'nivel-alerta'}>{ROTULO_ACAO[l.acao] ?? l.acao}</span>{l.detalhes && 'codigo' in l.detalhes ? <span className="fraco"> · {String(l.detalhes.codigo)}</span> : null}</td>
                    <td>{nome(l.profissionalId)}</td>
                    <td className="mono">{l.dispositivoId}</td>
                    <td>{l.detalhes?.offline ? <span className="selo selo-offline">Offline</span> : <span className="selo">Online</span>}</td>
                    <td className="mono">{fmtDataHora(l.recebidoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao page={dados} onPagina={setPagina} />
        </>
      )}
    </>
  );
}

const ESTRATEGIA: Record<string, string> = {
  LWW: 'Última edição vence', FIELD_MERGE: 'Mescla campo a campo', UNION: 'União de itens', SERVER_WINS: 'Registro finalizado prevalece',
};

function Conflitos() {
  const [pagina, setPagina] = useState(1);
  const { dados, erro } = useApi<Page<SyncConflito>>(`/sync/conflito?pagina=${pagina}&tamanho=20`);
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;
  if (dados.itens.length === 0) {
    return <div className="vazio"><strong>Nenhum conflito até agora.</strong><p>Conflitos acontecem quando duas equipes editam o mesmo registro sem conexão. São resolvidos automaticamente e registrados aqui.</p></div>;
  }
  return (
    <>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th>Resolvido em</th><th>Registro</th><th>Estratégia</th><th className="num">Versões</th><th>Resultado</th></tr></thead>
          <tbody>
            {dados.itens.map((c) => {
              const r = c.valorResultante as Record<string, unknown>;
              return (
                <tr key={c.id}>
                  <td className="mono">{fmtDataHora(c.resolvidoEm)}</td>
                  <td>{c.entidade.toLowerCase()} <span className="mono fraco">{c.entidadeId.slice(0, 8)}</span></td>
                  <td>{ESTRATEGIA[c.estrategia] ?? c.estrategia}</td>
                  <td className="num mono">base {c.versaoBaseCliente ?? '—'} → servidor {c.versaoServidor}</td>
                  <td className="truncar">{Array.isArray(r?.alergias) ? `Alergias: ${(r.alergias as string[]).join(', ')}` : String(r?.nome ?? r?.queixaPrincipal ?? '')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Paginacao page={dados} onPagina={setPagina} />
    </>
  );
}
