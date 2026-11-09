import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, FileDown, Mail, Pencil, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { glasgowGravidade, type Destinatario, type EnvioEmail, type EnvioEmailResponse } from '@medicalfield/shared';
import { api, ApiError, NetworkUnavailableError, novoId } from '../../api/client';
import { local } from '../../data/repositories';
import { SeloOffline, SeloSync } from '../components/Selos';
import { TagTriagem } from '../components/Triagem';
import { fmtDataHora, fmtHora } from '../format';
import { useRede } from '../hooks';

export function AtendimentoVer() {
  const { id = '' } = useParams();
  const rede = useRede();
  const dados = useLiveQuery(async () => {
    const a = await local.atendimentos.buscar(id);
    if (!a) return { a: null };
    const [pessoa, prontuario, medicamentos, hospital, viatura] = await Promise.all([
      local.pessoas.buscar(a.pessoaId),
      local.prontuarios.buscar(a.prontuarioId),
      local.medicamentos.listar(),
      a.hospitalDestinoId ? local.hospitais.buscar(a.hospitalDestinoId) : undefined,
      a.viaturaId ? local.viaturas.buscar(a.viaturaId) : undefined,
    ]);
    return { a, pessoa, prontuario, nomes: new Map(medicamentos.map((m) => [m.id, m.nome])), hospital, viatura };
  }, [id]);

  if (!dados) return <div className="pagina"><div className="esqueleto" style={{ height: 320 }} /></div>;
  if (!dados.a) return <div className="pagina"><div className="vazio"><strong>Atendimento não encontrado neste aparelho.</strong></div></div>;
  const { a, pessoa, prontuario, nomes, hospital, viatura } = dados;
  const naCentral = a.syncStatus === 'SINCRONIZADO';

  return (
    <div className="pagina">
      <div className="ficha-cabeca">
        <TagTriagem triagem={a.triagem} grande comSignificado />
        <div className="ficha-titulo">
          <h1>{pessoa?.nome ?? 'Paciente'}</h1>
          <p className="subtitulo">{a.queixaPrincipal}</p>
        </div>
        <div className="selos">
          {a.criadoOffline && <SeloOffline />}
          <SeloSync status={a.syncStatus} erro={a.syncErro} />
        </div>
      </div>
      {a.syncStatus === 'ERRO' && a.syncErro && (
        <div className="alerta alerta-erro" role="alert">
          <ShieldAlert aria-hidden />
          <div><strong>A central recusou este registro</strong><p>{a.syncErro}</p></div>
        </div>
      )}
      {prontuario && prontuario.alergias.length > 0 && (
        <div className="alergias"><b>Alergias</b> {prontuario.alergias.join(' · ')}</div>
      )}

      <div className="acoes-principais">
        {a.status === 'RASCUNHO' && (
          <Link to={`/atendimento/${a.id}/editar`} className="btn btn-primario btn-grande">
            <Pencil aria-hidden /> Continuar atendimento
          </Link>
        )}
        <Link to={`/paciente/${a.pessoaId}`} className="btn btn-grande">Ver paciente</Link>
      </div>

      <section className="painel bloco">
        <div className="secao-titulo"><h2>Ocorrência</h2><span className="mono fraco">{a.status === 'FINALIZADO' ? 'Finalizado' : 'Em andamento'}</span></div>
        <dl className="dados">
          <div><dt>Início</dt><dd className="mono">{fmtDataHora(a.iniciadoEm)}</dd></div>
          <div><dt>Fim</dt><dd className="mono">{fmtDataHora(a.finalizadoEm)}</dd></div>
          <div className="largo"><dt>Local</dt><dd>{a.local.descricao}</dd></div>
          <div><dt>Viatura</dt><dd>{viatura?.prefixo ?? '—'}</dd></div>
          <div><dt>Destino</dt><dd>{hospital?.nome ?? '—'}</dd></div>
          <div><dt>Glasgow</dt><dd><span className="mono">{a.glasgow.total}</span>/15 · {glasgowGravidade(a.glasgow.total).toLowerCase()} <span className="fraco mono">(O{a.glasgow.ocular} V{a.glasgow.verbal} M{a.glasgow.motora})</span></dd></div>
          <div><dt>Protocolo</dt><dd>{a.triagem.protocolo === 'START' ? 'START' : 'Manchester'}</dd></div>
          {a.descricao && <div className="largo"><dt>Descrição</dt><dd className="texto">{a.descricao}</dd></div>}
          {a.procedimentos.length > 0 && <div className="largo"><dt>Procedimentos</dt><dd>{a.procedimentos.join(' · ')}</dd></div>}
        </dl>
      </section>

      <section className="painel bloco">
        <div className="secao-titulo"><h2>Sinais vitais</h2></div>
        {a.sinaisVitais.length === 0 ? <p className="nota">Nenhuma aferição.</p> : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Hora</th><th className="num">PA</th><th className="num">FC</th><th className="num">FR</th><th className="num">SpO₂</th><th className="num">Temp.</th><th className="num">Glic.</th><th className="num">Dor</th></tr></thead>
              <tbody>
                {a.sinaisVitais.map((s) => (
                  <tr key={s.id} className="mono">
                    <td>{fmtHora(s.aferidoEm)}</td>
                    <td className="num">{s.paSistolica && s.paDiastolica ? `${s.paSistolica}/${s.paDiastolica}` : '—'}</td>
                    <td className="num">{s.fc ?? '—'}</td><td className="num">{s.fr ?? '—'}</td><td className="num">{s.spo2 ?? '—'}</td>
                    <td className="num">{s.temperatura ?? '—'}</td><td className="num">{s.glicemia ?? '—'}</td><td className="num">{s.dor ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="painel bloco">
        <div className="secao-titulo"><h2>Medicamentos</h2></div>
        {a.medicamentos.length === 0 ? <p className="nota">Nenhum medicamento administrado.</p> : (
          <ul className="lista-medicamentos">
            {a.medicamentos.map((m) => (
              <li key={m.id}>
                <time className="mono">{fmtHora(m.administradoEm)}</time>
                <div>
                  <strong>{nomes.get(m.medicamentoId) ?? 'Medicamento'}</strong> <span className="mono">{m.dose} {m.unidade}</span> · {m.via}
                  {m.alertasIgnorados.length > 0 && <div className="justificado"><ShieldAlert aria-hidden /> {m.alertasIgnorados.map((x) => x.justificativa).join('; ')}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Ficha atendimentoId={a.id} naCentral={naCentral} online={rede.online} sugestoes={destinatariosSugeridos(pessoa)} />
    </div>
  );
}

function destinatariosSugeridos(p?: { nome: string; email?: string | null; contatoNome?: string | null; contatoEmail?: string | null }): Destinatario[] {
  const lista: Destinatario[] = [];
  if (p?.email) lista.push({ email: p.email, nome: p.nome, tipo: 'PACIENTE' });
  if (p?.contatoEmail) lista.push({ email: p.contatoEmail, nome: p.contatoNome ?? null, tipo: 'FAMILIAR' });
  return lista;
}

function Ficha({ atendimentoId, naCentral, online, sugestoes }: { atendimentoId: string; naCentral: boolean; online: boolean; sugestoes: Destinatario[] }) {
  const [baixando, setBaixando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [envios, setEnvios] = useState<EnvioEmail[]>([]);
  const [dest, setDest] = useState<Destinatario>(sugestoes[1] ?? sugestoes[0] ?? { email: '', nome: '', tipo: 'FAMILIAR' });
  const disponivel = naCentral && online;

  const carregarEnvios = useCallback(async () => {
    if (!disponivel) return;
    try {
      setEnvios(await api<EnvioEmail[]>('GET', `/ficha/${atendimentoId}/envios`));
    } catch {
      /* histórico é complementar */
    }
  }, [atendimentoId, disponivel]);

  useEffect(() => {
    void carregarEnvios();
  }, [carregarEnvios]);

  const tratar = (e: unknown) =>
    setErro(e instanceof NetworkUnavailableError ? 'Sem conexão com a central.' : e instanceof ApiError ? e.message : 'Falha inesperada.');

  async function baixar() {
    setErro(null);
    setBaixando(true);
    try {
      const blob = await api<Blob>('GET', `/ficha/${atendimentoId}/pdf`, undefined, { blob: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ficha-atendimento-${atendimentoId.slice(0, 8)}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      tratar(e);
    } finally {
      setBaixando(false);
    }
  }

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      await api<EnvioEmailResponse>('POST', `/ficha/${atendimentoId}/email`, { destinatarios: [dest] }, { idempotencyKey: novoId() });
      await carregarEnvios();
    } catch (e) {
      tratar(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="painel bloco" aria-labelledby="t-ficha">
      <div className="secao-titulo"><h2 id="t-ficha">Ficha de atendimento</h2></div>
      {!disponivel && (
        <p className="nota">
          {naCentral ? 'Conecte-se para gerar ou enviar a ficha.' : 'A ficha fica disponível quando este atendimento chegar à central.'}
        </p>
      )}
      <div className="ficha-acoes">
        <button type="button" className="btn btn-grande" onClick={() => void baixar()} disabled={!disponivel} data-carregando={baixando}>
          <FileDown aria-hidden /> Baixar ficha (PDF)
        </button>
      </div>
      <fieldset className="grupo envio" disabled={!disponivel}>
        <legend>Enviar por e-mail</legend>
        <div className="grade-3">
          <div className="campo">
            <label htmlFor="e-email">E-mail</label>
            <input id="e-email" type="email" value={dest.email} onChange={(e) => setDest({ ...dest, email: e.target.value })} list="e-sugestoes" />
            <datalist id="e-sugestoes">{sugestoes.map((s) => <option key={s.email} value={s.email}>{s.nome}</option>)}</datalist>
          </div>
          <div className="campo">
            <label htmlFor="e-nome">Nome</label>
            <input id="e-nome" value={dest.nome ?? ''} onChange={(e) => setDest({ ...dest, nome: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="e-tipo">Destinatário</label>
            <select id="e-tipo" value={dest.tipo} onChange={(e) => setDest({ ...dest, tipo: e.target.value as Destinatario['tipo'] })}>
              <option value="PACIENTE">Paciente</option>
              <option value="FAMILIAR">Familiar</option>
              <option value="HOSPITAL">Hospital</option>
            </select>
          </div>
        </div>
        <button type="button" className="btn btn-primario btn-grande" onClick={() => void enviar()} disabled={!dest.email} data-carregando={enviando}>
          <Mail aria-hidden /> Enviar ficha
        </button>
      </fieldset>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      {envios.length > 0 && (
        <ul className="envios">
          {envios.map((e) => (
            <li key={e.id} data-status={e.status}>
              <CheckCircle2 aria-hidden />
              <span>{e.status === 'ENVIADO' ? 'Enviada' : e.status === 'FALHOU' ? 'Falhou' : 'Enviando'} para <strong>{e.destinatarioNome ?? e.destinatarioEmail}</strong> ({e.destinatarioEmail})</span>
              <time className="mono">{fmtDataHora(e.enviadoEm ?? e.criadoEm)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
