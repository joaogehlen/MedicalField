import { ArrowLeft, CheckCircle2, FileDown, Mail, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { v7 as uuidv7 } from 'uuid';
import { glasgowGravidade, type AtendimentoDetalhe as Detalhe, type Destinatario, type EnvioEmail } from '@medicalfield/shared';
import { api, useApi, useProfissionais } from '../api';
import { Carregando, Erro, SeloOffline, TagTriagem } from '../components/ui';
import { fmtCpf, fmtDataHora, fmtHora, idade } from '../format';

export function AtendimentoDetalhe() {
  const { id = '' } = useParams();
  const nome = useProfissionais();
  const { dados: a, erro } = useApi<Detalhe>(`/atendimento/detalhe/${id}`);

  if (erro) return <div className="pagina"><Erro mensagem={erro} /></div>;
  if (!a) return <div className="pagina"><Carregando linhas={8} /></div>;
  const meds = new Map(a.medicamentosCatalogo.map((m) => [m.id, m]));

  return (
    <div className="pagina">
      <Link to="/atendimentos" className="voltar"><ArrowLeft aria-hidden /> Atendimentos</Link>
      <div className="ficha-cabeca">
        <TagTriagem triagem={a.triagem} grande comSignificado />
        <div className="ficha-titulo">
          <h1>{a.pessoa.nome}</h1>
          <p className="subtitulo">{a.queixaPrincipal} · <span className="mono">{fmtDataHora(a.iniciadoEm)}</span></p>
        </div>
        <div className="selos">
          {a.criadoOffline && <SeloOffline />}
          <span className="selo">{a.status === 'FINALIZADO' ? 'Finalizado' : 'Em andamento'}</span>
        </div>
      </div>

      {a.prontuario.alergias.length > 0 && <div className="alergias"><b>Alergias</b> {a.prontuario.alergias.join(' · ')}</div>}

      <div className="duas-colunas">
        <section className="painel bloco">
          <div className="secao-titulo"><h2>Paciente</h2><Link to={`/prontuarios/${a.prontuario.id}`}>Prontuário</Link></div>
          <dl className="dados">
            <div><dt>CPF</dt><dd className="mono">{a.pessoa.identificada ? fmtCpf(a.pessoa.cpf) : 'Não identificado'}</dd></div>
            <div><dt>Idade</dt><dd>{idade(a.pessoa.dataNascimento) ?? '—'}</dd></div>
            <div><dt>Tipo sanguíneo</dt><dd>{a.prontuario.tipoSanguineo ?? '—'}</dd></div>
            <div><dt>Comorbidades</dt><dd>{a.prontuario.comorbidades.join(', ') || '—'}</dd></div>
            <div className="largo"><dt>Contato</dt><dd>{[a.pessoa.contatoNome, a.pessoa.contatoParentesco, a.pessoa.contatoTelefone].filter(Boolean).join(' · ') || '—'}</dd></div>
            {a.pessoa.caracteristicas && <div className="largo"><dt>Características</dt><dd>{a.pessoa.caracteristicas}</dd></div>}
          </dl>
        </section>
        <section className="painel bloco">
          <div className="secao-titulo"><h2>Ocorrência</h2></div>
          <dl className="dados">
            <div className="largo"><dt>Local</dt><dd>{a.local.descricao}</dd></div>
            <div><dt>Viatura</dt><dd>{a.viatura?.prefixo ?? '—'}</dd></div>
            <div><dt>Destino</dt><dd>{a.hospitalDestino?.nome ?? '—'}</dd></div>
            <div><dt>Glasgow</dt><dd><span className="mono">{a.glasgow.total}</span>/15 · {glasgowGravidade(a.glasgow.total).toLowerCase()} <span className="fraco mono">O{a.glasgow.ocular} V{a.glasgow.verbal} M{a.glasgow.motora}</span></dd></div>
            <div><dt>Finalizado</dt><dd className="mono">{fmtDataHora(a.finalizadoEm)}</dd></div>
            <div className="largo"><dt>Registrado por</dt><dd>{nome(a.registradoPor)}</dd></div>
            <div><dt>Recebido pela central</dt><dd className="mono">{fmtDataHora(a.sincronizadoEm)}</dd></div>
            <div><dt>Dispositivo</dt><dd className="mono">{a.dispositivoId}</dd></div>
            {a.descricao && <div className="largo"><dt>Descrição</dt><dd className="texto">{a.descricao}</dd></div>}
            {a.procedimentos.length > 0 && <div className="largo"><dt>Procedimentos</dt><dd>{a.procedimentos.join(' · ')}</dd></div>}
          </dl>
        </section>
      </div>

      <section className="painel bloco">
        <div className="secao-titulo"><h2>Sinais vitais</h2></div>
        {a.sinaisVitais.length === 0 ? <p className="nota">Nenhuma aferição.</p> : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Hora</th><th className="num">PA (mmHg)</th><th className="num">FC (bpm)</th><th className="num">FR (irpm)</th><th className="num">SpO₂ (%)</th><th className="num">Temp. (°C)</th><th className="num">Glicemia</th><th className="num">Dor</th></tr></thead>
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
        <div className="secao-titulo"><h2>Medicamentos administrados</h2></div>
        {a.medicamentos.length === 0 ? <p className="nota">Nenhum medicamento administrado.</p> : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Hora</th><th>Medicamento</th><th className="num">Dose</th><th>Via</th><th>Administrado por</th></tr></thead>
              <tbody>
                {a.medicamentos.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{fmtHora(m.administradoEm)}</td>
                    <td>
                      <strong>{meds.get(m.medicamentoId)?.nome ?? 'Medicamento'}</strong>
                      <div className="fraco">{meds.get(m.medicamentoId)?.apresentacao}</div>
                      {m.alertasIgnorados.map((x) => <div key={x.codigo} className="justificado"><ShieldAlert aria-hidden /> {x.codigo}: {x.justificativa}</div>)}
                    </td>
                    <td className="num mono">{m.dose} {m.unidade}</td>
                    <td className="mono">{m.via}</td>
                    <td>{nome(m.administradoPor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(a.adendos ?? []).length > 0 && (
        <section className="painel bloco">
          <div className="secao-titulo"><h2>Adendos</h2></div>
          {(a.adendos ?? []).map((d) => <p key={d.id}><span className="mono fraco">{fmtDataHora(d.criadoEm)}</span> {d.texto}</p>)}
        </section>
      )}

      <Ficha detalhe={a} />
    </div>
  );
}

interface Documento {
  id: string;
  versaoAtendimento: number;
  sha256: string;
  geradoEm: string;
}

function Ficha({ detalhe: a }: { detalhe: Detalhe }) {
  const sugestoes: Destinatario[] = [];
  if (a.pessoa.contatoEmail) sugestoes.push({ email: a.pessoa.contatoEmail, nome: a.pessoa.contatoNome ?? null, tipo: 'FAMILIAR' });
  if (a.pessoa.email) sugestoes.push({ email: a.pessoa.email, nome: a.pessoa.nome, tipo: 'PACIENTE' });
  const [dest, setDest] = useState<Destinatario>(sugestoes[0] ?? { email: '', nome: '', tipo: 'FAMILIAR' });
  const [envios, setEnvios] = useState<EnvioEmail[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [ocupado, setOcupado] = useState<'pdf' | 'email' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setEnvios(await api<EnvioEmail[]>('GET', `/ficha/${a.id}/envios`).catch(() => []));
    setDocumentos(await api<Documento[]>('GET', `/ficha/${a.id}/documentos`).catch(() => []));
  }, [a.id]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function baixar() {
    setErro(null);
    setOcupado('pdf');
    try {
      const blob = await api<Blob>('GET', `/ficha/${a.id}/pdf`, undefined, { blob: true });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar a ficha.');
    } finally {
      setOcupado(null);
    }
  }

  async function enviar() {
    setErro(null);
    setOcupado('email');
    try {
      await api('POST', `/ficha/${a.id}/email`, { destinatarios: [dest] }, { idempotencyKey: uuidv7() });
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="painel bloco" aria-labelledby="t-ficha">
      <div className="secao-titulo"><h2 id="t-ficha">Ficha de atendimento</h2></div>
      <div className="ficha-linha">
        <button type="button" className="btn btn-grande" onClick={() => void baixar()} data-carregando={ocupado === 'pdf'}>
          <FileDown aria-hidden /> Gerar ficha (PDF)
        </button>
        {documentos[0] && <span className="fraco">Última emissão {fmtDataHora(documentos[0].geradoEm)} · SHA-256 <span className="mono">{documentos[0].sha256.slice(0, 16)}…</span></span>}
      </div>
      <fieldset className="grupo">
        <legend>Enviar por e-mail</legend>
        <div className="envio-linha">
          <div className="campo">
            <label htmlFor="d-email">E-mail</label>
            <input id="d-email" type="email" list="d-sug" value={dest.email} onChange={(e) => setDest({ ...dest, email: e.target.value })} />
            <datalist id="d-sug">{sugestoes.map((s) => <option key={s.email} value={s.email}>{s.nome}</option>)}</datalist>
          </div>
          <div className="campo">
            <label htmlFor="d-nome">Nome</label>
            <input id="d-nome" value={dest.nome ?? ''} onChange={(e) => setDest({ ...dest, nome: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="d-tipo">Destinatário</label>
            <select id="d-tipo" value={dest.tipo} onChange={(e) => setDest({ ...dest, tipo: e.target.value as Destinatario['tipo'] })}>
              <option value="FAMILIAR">Familiar</option>
              <option value="PACIENTE">Paciente</option>
              <option value="HOSPITAL">Hospital</option>
            </select>
          </div>
          <button type="button" className="btn btn-primario btn-grande" onClick={() => void enviar()} disabled={!dest.email} data-carregando={ocupado === 'email'}>
            <Mail aria-hidden /> Enviar ficha
          </button>
        </div>
      </fieldset>
      {erro && <Erro mensagem={erro} />}
      {envios.length > 0 && (
        <ul className="envios">
          {envios.map((e) => (
            <li key={e.id} data-status={e.status}>
              <CheckCircle2 aria-hidden />
              <span>{e.status === 'ENVIADO' ? 'Enviada' : 'Falhou'} para <strong>{e.destinatarioNome ?? e.destinatarioEmail}</strong> &lt;{e.destinatarioEmail}&gt;{e.erro ? ` — ${e.erro}` : ''}</span>
              <span className="mono fraco">{fmtDataHora(e.enviadoEm ?? e.criadoEm)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
