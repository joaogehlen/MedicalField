import { useLiveQuery } from 'dexie-react-hooks';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessao } from '../../auth/session';
import { db } from '../../data/db';
import { syncEngine } from '../../sync/engine';
import { ChaveRede } from '../components/Casca';
import { fmtDataHora, relativo } from '../format';
import { usePendentes, useRede, useSync } from '../hooks';

const ROTULO_OP = { UPSERT_PESSOA: 'Vítima', UPSERT_PRONTUARIO: 'Prontuário', UPSERT_ATENDIMENTO: 'Atendimento' } as const;
const ROTULO_STATUS = { PENDENTE: 'Aguardando conexão', ENVIANDO: 'Enviando', ERRO: 'Recusado', CONCLUIDO: 'Na central' } as const;

export function Sincronizacao() {
  const rede = useRede();
  const sync = useSync();
  const pend = usePendentes();
  const navegar = useNavigate();
  const [limpando, setLimpando] = useState(false);
  const dados = useLiveQuery(async () => ({
    ops: await db.outbox.reverse().limit(30).toArray(),
    logs: await db.logsLocais.where('enviado').equals(0).count(),
    medicamentos: await db.medicamentos.count(),
    pessoas: await db.pessoas.count(),
    atendimentos: await db.atendimentos.count(),
    cursor: await db.lerMeta<number>('syncCursor', 0),
  }));

  async function limpar() {
    const msg = pend.total
      ? `Há ${pend.total} registro(s) que não chegaram à central e serão PERDIDOS. Apagar todos os dados deste aparelho?`
      : 'Apagar todos os dados deste aparelho? Os registros já estão na central.';
    if (!window.confirm(msg)) return;
    setLimpando(true);
    await Promise.all(db.tables.map((t) => t.clear()));
    sessao.definir(null);
    navegar('/entrar');
  }

  return (
    <div className="pagina">
      <h1>Sincronização</h1>

      <section className="painel bloco estado-rede" data-online={rede.online}>
        <div>
          <h2>{rede.online ? 'Conectado à central' : 'Fora da rede'}</h2>
          <p className="nota">
            {rede.online
              ? 'Cada registro sai do aparelho assim que é salvo.'
              : !rede.simulador
                ? 'Conexão desligada pelo simulador. Registre normalmente: tudo vai para a fila e é enviado quando você religar.'
                : 'O aparelho está sem rede. Os registros ficam na fila até o sinal voltar.'}
          </p>
        </div>
        <ChaveRede />
      </section>

      {sync.precisaLogin && (
        <div className="alerta alerta-aviso" role="alert">
          <span aria-hidden>!</span>
          <div>
            <strong>Entre novamente para enviar</strong>
            <p>Sua sessão expirou durante o plantão. Os registros continuam guardados; entre com conexão para enviá-los.</p>
            <button type="button" className="btn" onClick={() => { sessao.definir(null); navegar('/entrar'); }}>Entrar novamente</button>
          </div>
        </div>
      )}
      {sync.erro && !sync.precisaLogin && <div className="alerta alerta-erro" role="alert"><span aria-hidden>!</span><p>{sync.erro}</p></div>}

      <div className="grade-2 cartoes-sync">
        <section className="painel bloco">
          <h2>Enviar para a central</h2>
          <p className="numero-grande mono">{pend.total}</p>
          <p className="nota">{pend.total === 1 ? 'operação pendente' : 'operações pendentes'} · {dados?.logs ?? 0} logs locais · último envio {relativo(sync.ultimaSync)}</p>
          <button type="button" className="btn btn-grande" onClick={() => void syncEngine.push()} disabled={!rede.online || sync.sincronizando} data-carregando={sync.fase === 'ENVIANDO'}>
            <Upload aria-hidden /> Enviar agora
          </button>
        </section>
        <section className="painel bloco">
          <h2>Receber da central</h2>
          <p className="numero-grande mono">{dados?.medicamentos ?? 0}</p>
          <p className="nota">medicamentos · {dados?.pessoas ?? 0} pacientes · {dados?.atendimentos ?? 0} atendimentos · recebido {relativo(sync.ultimoRecebimento)}</p>
          <button type="button" className="btn btn-primario btn-grande" onClick={() => void syncEngine.pull()} disabled={!rede.online || sync.sincronizando} data-carregando={sync.fase === 'RECEBENDO'}>
            <Download aria-hidden /> Receber dados da central
          </button>
        </section>
      </div>

      <section>
        <h2 className="grupo-titulo">Fila de envio (Outbox)</h2>
        {!dados || dados.ops.length === 0 ? (
          <p className="nota">Nada foi registrado neste aparelho ainda.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Criada</th><th>Registro</th><th>Situação</th><th className="num">Tentativas</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {dados.ops.map((o) => (
                  <tr key={o.seq}>
                    <td className="mono">{fmtDataHora(o.criadoEm)}</td>
                    <td>{ROTULO_OP[o.tipo]} <span className="fraco mono">{o.entidadeId.slice(-8)}</span></td>
                    <td>
                      <span className={`selo ${o.status === 'CONCLUIDO' ? 'selo-ok' : o.status === 'ERRO' ? 'selo-erro' : 'selo-pendente'}`}>{ROTULO_STATUS[o.status]}</span>
                      {o.ultimoErro && o.status !== 'CONCLUIDO' && <div className="fraco">{o.ultimoErro}</div>}
                    </td>
                    <td className="num mono">{o.tentativas}</td>
                    <td>
                      {o.status === 'ERRO' && (
                        <div className="acoes-linha">
                          <button type="button" className="btn btn-fantasma" onClick={() => void syncEngine.tentarNovamente(o.seq!)}><RotateCcw aria-hidden /> Reenviar</button>
                          <button type="button" className="btn btn-fantasma" onClick={() => void syncEngine.descartar(o.seq!)}>Descartar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="nota mono">Cursor de recebimento: {dados?.cursor ?? 0}</p>
      </section>

      <section className="zona-perigo">
        <h2>Limpar este aparelho</h2>
        <p className="nota">Apaga pacientes, atendimentos, catálogo e credenciais guardados aqui. Use ao devolver o aparelho à base.</p>
        <button type="button" className="btn btn-perigo" onClick={() => void limpar()} data-carregando={limpando}>
          <Trash2 aria-hidden /> Limpar dados locais
        </button>
      </section>
    </div>
  );
}
