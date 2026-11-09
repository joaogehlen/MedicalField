import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, MapPin, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  alertasImpeditivos,
  avaliarAdministracao,
  CLASSIFICACOES_POR_PROTOCOLO,
  FAIXAS_VITAIS,
  GLASGOW_MOTORA,
  GLASGOW_OCULAR,
  GLASGOW_VERBAL,
  glasgowGravidade,
  INFO_CLASSIFICACAO,
  significadoClassificacao,
  sinalVitalSchema,
  vitalAlterado,
  type AdministracaoMedicamento,
  type AlertaIgnorado,
  type CampoVital,
  type Classificacao,
  type Medicamento,
  type ProtocoloTriagem,
  type SinalVital,
  type ViaAdministracao,
} from '@medicalfield/shared';
import { sessao } from '../../auth/session';
import { local } from '../../data/repositories';
import { registrarLog } from '../../services/logs';
import { novoId, salvarAtendimento } from '../../services/registro';
import { errosPorCampo, ResumoErros } from '../components/Erros';
import { Etapas } from '../components/Etapas';
import { Termos } from '../components/Termos';
import { deInputLocal, fmtHora, paraInputLocal } from '../format';

const PROCEDIMENTOS = ['Colar cervical', 'Prancha rígida', 'Acesso venoso periférico', 'Oxigenoterapia', 'Imobilização de membro', 'Curativo compressivo', 'Monitorização'];

interface Rascunho {
  id: string;
  pessoaId: string;
  prontuarioId: string;
  iniciadoEm: string;
  localDescricao: string;
  latitude: number | null;
  longitude: number | null;
  queixaPrincipal: string;
  descricao: string;
  viaturaId: string | null;
  hospitalDestinoId: string | null;
  protocolo: ProtocoloTriagem;
  classificacao: Classificacao | null;
  ocular: number | null;
  verbal: number | null;
  motora: number | null;
  sinaisVitais: SinalVital[];
  medicamentos: AdministracaoMedicamento[];
  procedimentos: string[];
}

function Secao({ id, titulo, children, extra }: { id: string; titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="painel bloco" aria-labelledby={id}>
      <div className="secao-titulo">
        <h2 id={id}>{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function AtendimentoForm() {
  const { id: pessoaParam, atendimentoId } = useParams();
  const [params] = useSearchParams();
  const fluxo = params.get('fluxo') === 'nova';
  const navegar = useNavigate();

  const dados = useLiveQuery(async () => {
    const existente = atendimentoId ? await local.atendimentos.buscar(atendimentoId) : undefined;
    const pessoaId = existente?.pessoaId ?? pessoaParam ?? '';
    const [pessoa, prontuario, medicamentos, hospitais, viaturas] = await Promise.all([
      local.pessoas.buscar(pessoaId),
      existente ? local.prontuarios.buscar(existente.prontuarioId) : local.prontuarios.daPessoa(pessoaId),
      local.medicamentos.listar(),
      local.hospitais.listar(),
      local.viaturas.listar(),
    ]);
    return { existente, pessoa, prontuario, medicamentos, hospitais, viaturas };
  }, [pessoaParam, atendimentoId]);

  const [r, setR] = useState<Rascunho | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<'RASCUNHO' | 'FINALIZADO' | null>(null);

  useEffect(() => {
    if (!dados || r) return;
    const e = dados.existente;
    if (e) {
      setR({
        id: e.id, pessoaId: e.pessoaId, prontuarioId: e.prontuarioId, iniciadoEm: e.iniciadoEm,
        localDescricao: e.local.descricao, latitude: e.local.latitude ?? null, longitude: e.local.longitude ?? null,
        queixaPrincipal: e.queixaPrincipal, descricao: e.descricao ?? '', viaturaId: e.viaturaId ?? null,
        hospitalDestinoId: e.hospitalDestinoId ?? null, protocolo: e.triagem.protocolo, classificacao: e.triagem.classificacao,
        ocular: e.glasgow.ocular, verbal: e.glasgow.verbal, motora: e.glasgow.motora, sinaisVitais: e.sinaisVitais,
        medicamentos: e.medicamentos, procedimentos: e.procedimentos,
      });
    } else if (dados.pessoa && dados.prontuario) {
      setR({
        id: novoId(), pessoaId: dados.pessoa.id, prontuarioId: dados.prontuario.id, iniciadoEm: new Date().toISOString(),
        localDescricao: '', latitude: null, longitude: null, queixaPrincipal: '', descricao: '',
        viaturaId: dados.viaturas[0]?.id ?? null, hospitalDestinoId: null, protocolo: 'START', classificacao: null,
        ocular: null, verbal: null, motora: null, sinaisVitais: [], medicamentos: [], procedimentos: [],
      });
    }
  }, [dados, r]);

  if (!dados || !r) return <div className="pagina"><div className="esqueleto" style={{ height: 320 }} /></div>;
  if (!dados.pessoa || !dados.prontuario) {
    return (
      <div className="pagina">
        <div className="vazio">
          <strong>Este paciente ainda não tem prontuário.</strong>
          <button type="button" className="btn btn-primario" onClick={() => navegar(`/paciente/${pessoaParam}/prontuario`)}>Abrir prontuário</button>
        </div>
      </div>
    );
  }
  if (dados.existente?.status === 'FINALIZADO') {
    return <div className="pagina"><div className="vazio"><strong>Atendimento finalizado não pode ser alterado.</strong></div></div>;
  }

  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setR((x) => (x ? { ...x, [k]: v } : x));
  const nuncaSincronizado = dados.existente?.version === undefined;
  const glasgowTotal = r.ocular && r.verbal && r.motora ? r.ocular + r.verbal + r.motora : null;

  async function salvar(status: 'RASCUNHO' | 'FINALIZADO') {
    if (!r) return;
    const faltas: Record<string, string> = {};
    if (!r.classificacao) faltas['triagem.classificacao'] = 'Escolha a classificação da triagem.';
    if (!r.ocular || !r.verbal || !r.motora) faltas.glasgow = 'Marque as três respostas da Escala de Glasgow.';
    if (Object.keys(faltas).length) {
      setErros(faltas);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSalvando(status);
    try {
      const salvo = await salvarAtendimento({
        id: r.id,
        pessoaId: r.pessoaId,
        prontuarioId: r.prontuarioId,
        viaturaId: r.viaturaId,
        hospitalDestinoId: r.hospitalDestinoId,
        status,
        iniciadoEm: r.iniciadoEm,
        finalizadoEm: status === 'FINALIZADO' ? new Date().toISOString() : null,
        local: { descricao: r.localDescricao, latitude: r.latitude, longitude: r.longitude },
        queixaPrincipal: r.queixaPrincipal,
        descricao: r.descricao,
        triagem: { protocolo: r.protocolo, classificacao: r.classificacao! },
        glasgow: { ocular: r.ocular!, verbal: r.verbal!, motora: r.motora!, total: glasgowTotal! },
        sinaisVitais: r.sinaisVitais,
        medicamentos: r.medicamentos,
        procedimentos: r.procedimentos,
      });
      navegar(`/atendimento/${salvo.id}`, { replace: true });
    } catch (e) {
      const porCampo = errosPorCampo(e);
      setErros(Object.keys(porCampo).length ? porCampo : { _: e instanceof Error ? e.message : 'Não foi possível salvar.' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSalvando(null);
    }
  }

  const usarLocalizacao = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setR((x) => (x ? { ...x, latitude: p.coords.latitude, longitude: p.coords.longitude } : x)),
      () => setErros({ local: 'Não foi possível obter a localização do aparelho.' }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="pagina pagina-form">
      {fluxo && <Etapas atual={2} />}
      <div className="pagina-cabeca">
        <div>
          <h1>{dados.existente ? 'Continuar atendimento' : 'Novo atendimento'}</h1>
          <p className="subtitulo">{dados.pessoa.nome}</p>
        </div>
      </div>
      {dados.prontuario.alergias.length > 0 && (
        <div className="alergias">
          <b>Alergias</b> {dados.prontuario.alergias.join(' · ')}
        </div>
      )}
      <ResumoErros erros={erros} />

      <div className="form-pilha">
        <Secao id="s-ocorrencia" titulo="Ocorrência">
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="inicio">Início do atendimento</label>
              <input id="inicio" type="datetime-local" className="mono" value={paraInputLocal(r.iniciadoEm)} onChange={(e) => e.target.value && set('iniciadoEm', deInputLocal(e.target.value))} />
            </div>
            <div className="campo">
              <label htmlFor="viatura">Viatura</label>
              <select id="viatura" value={r.viaturaId ?? ''} onChange={(e) => set('viaturaId', e.target.value || null)}>
                <option value="">Sem viatura</option>
                {dados.viaturas.map((v) => (
                  <option key={v.id} value={v.id}>{v.prefixo} · {v.base}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="local">Local da ocorrência</label>
            <div className="entrada-com-acao">
              <input id="local" value={r.localDescricao} onChange={(e) => set('localDescricao', e.target.value)} placeholder="Rodovia e km, endereço ou referência" aria-invalid={!!erros['local.descricao']} />
              {window.isSecureContext && 'geolocation' in navigator && (
                <button type="button" className="btn" onClick={usarLocalizacao}>
                  <MapPin aria-hidden /> GPS
                </button>
              )}
            </div>
            {r.latitude !== null && r.longitude !== null && <span className="ajuda mono">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</span>}
          </div>
          <div className="campo">
            <label htmlFor="queixa">Queixa principal</label>
            <input id="queixa" value={r.queixaPrincipal} onChange={(e) => set('queixaPrincipal', e.target.value)} placeholder="Ex.: colisão moto × carro, dor torácica" aria-invalid={!!erros.queixaPrincipal} />
          </div>
          <div className="campo">
            <label htmlFor="descricao">Descrição <span className="opcional">(opcional)</span></label>
            <textarea id="descricao" value={r.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Cinemática, achados do exame, condutas…" />
          </div>
        </Secao>

        <Secao id="s-triagem" titulo="Triagem">
          <fieldset className="segmentos">
            <legend>Protocolo</legend>
            {(['START', 'MANCHESTER'] as const).map((p) => (
              <label key={p} className="segmento">
                <input
                  type="radio"
                  name="protocolo"
                  checked={r.protocolo === p}
                  onChange={() => setR((x) => (x ? { ...x, protocolo: p, classificacao: x.classificacao && CLASSIFICACOES_POR_PROTOCOLO[p].includes(x.classificacao) ? x.classificacao : null } : x))}
                />
                <span>{p === 'START' ? 'START (múltiplas vítimas)' : 'Manchester'}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="segmentos escolha-triagem" aria-invalid={!!erros['triagem.classificacao']}>
            <legend>Classificação</legend>
            {CLASSIFICACOES_POR_PROTOCOLO[r.protocolo].map((c) => (
              <label key={c} className="segmento" style={{ ['--cor' as string]: `var(--t-${c.toLowerCase()})`, ['--tinta-tag' as string]: c === 'AMARELO' ? '#1a1a1a' : '#fff' }}>
                <input type="radio" name="classificacao" checked={r.classificacao === c} onChange={() => set('classificacao', c)} />
                <span>
                  {INFO_CLASSIFICACAO[c].rotulo}
                  <small>{significadoClassificacao(r.protocolo, c)}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </Secao>

        <Secao
          id="s-glasgow"
          titulo="Escala de Glasgow"
          extra={
            <span className="glasgow-total" data-gravidade={glasgowTotal ? glasgowGravidade(glasgowTotal) : undefined}>
              <span className="mono">{glasgowTotal ?? '–'}</span>/15 {glasgowTotal ? `· ${glasgowGravidade(glasgowTotal).toLowerCase()}` : ''}
            </span>
          }
        >
          {([
            ['ocular', 'Abertura ocular', GLASGOW_OCULAR],
            ['verbal', 'Resposta verbal', GLASGOW_VERBAL],
            ['motora', 'Resposta motora', GLASGOW_MOTORA],
          ] as const).map(([campo, rotulo, opcoes]) => (
            <fieldset key={campo} className="segmentos glasgow">
              <legend>{rotulo}</legend>
              {opcoes.map((o) => (
                <label key={o.valor} className="segmento">
                  <input type="radio" name={campo} checked={r[campo] === o.valor} onChange={() => set(campo, o.valor)} />
                  <span>
                    <b className="mono">{o.valor}</b> {o.descricao}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </Secao>

        <Secao id="s-sinais" titulo="Sinais vitais">
          {r.sinaisVitais.length > 0 && <TabelaSinais sinais={r.sinaisVitais} onRemover={nuncaSincronizado ? (id) => set('sinaisVitais', r.sinaisVitais.filter((s) => s.id !== id)) : undefined} />}
          <NovoSinal onAdicionar={(s) => set('sinaisVitais', [...r.sinaisVitais, s])} />
        </Secao>

        <Secao id="s-medicamentos" titulo="Medicamentos administrados">
          {r.medicamentos.length > 0 && (
            <ul className="lista-medicamentos">
              {r.medicamentos.map((m) => {
                const med = dados.medicamentos.find((x) => x.id === m.medicamentoId);
                return (
                  <li key={m.id}>
                    <time className="mono">{fmtHora(m.administradoEm)}</time>
                    <div>
                      <strong>{med?.nome ?? 'Medicamento'}</strong> <span className="mono">{m.dose} {m.unidade}</span> · {m.via}
                      {m.alertasIgnorados.length > 0 && <div className="justificado"><ShieldAlert aria-hidden /> Alerta justificado: {m.alertasIgnorados.map((a) => a.justificativa).join('; ')}</div>}
                    </div>
                    {nuncaSincronizado && (
                      <button type="button" className="btn btn-fantasma" aria-label="Remover" onClick={() => set('medicamentos', r.medicamentos.filter((x) => x.id !== m.id))}>
                        <Trash2 aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <NovaAdministracao
            catalogo={dados.medicamentos.filter((m) => m.ativo)}
            alergias={dados.prontuario.alergias}
            anteriores={r.medicamentos}
            onAdicionar={(m) => set('medicamentos', [...r.medicamentos, m])}
            atendimentoId={r.id}
          />
        </Secao>

        <Secao id="s-procedimentos" titulo="Procedimentos e destino">
          <Termos rotulo="Procedimentos realizados" valor={r.procedimentos} onChange={(v) => set('procedimentos', v)} sugestoes={PROCEDIMENTOS} placeholder="Digite e tecle Enter" />
          <div className="campo">
            <label htmlFor="destino">Hospital de destino</label>
            <select id="destino" value={r.hospitalDestinoId ?? ''} onChange={(e) => set('hospitalDestinoId', e.target.value || null)}>
              <option value="">Não definido / sem remoção</option>
              {dados.hospitais.filter((h) => h.ativo).map((h) => (
                <option key={h.id} value={h.id}>{h.nome} · {h.cidade}</option>
              ))}
            </select>
          </div>
        </Secao>
      </div>

      <div className="barra-acoes fixa">
        <button type="button" className="btn btn-grande" onClick={() => void salvar('RASCUNHO')} data-carregando={salvando === 'RASCUNHO'} disabled={!!salvando}>
          Salvar rascunho
        </button>
        <button type="button" className="btn btn-primario btn-grande" onClick={() => void salvar('FINALIZADO')} data-carregando={salvando === 'FINALIZADO'} disabled={!!salvando}>
          Finalizar atendimento
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Sinais vitais ------------------------------ */

const CAMPOS_VITAIS: CampoVital[] = ['paSistolica', 'paDiastolica', 'fc', 'fr', 'spo2', 'temperatura', 'glicemia', 'dor'];
const ROTULO_CURTO: Record<CampoVital, string> = {
  paSistolica: 'PA sist.', paDiastolica: 'PA diast.', fc: 'FC', fr: 'FR', spo2: 'SpO₂', temperatura: 'Temp.', glicemia: 'Glicemia', dor: 'Dor',
};

function TabelaSinais({ sinais, onRemover }: { sinais: SinalVital[]; onRemover?: (id: string) => void }) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th>Hora</th>
            <th className="num">PA</th>
            <th className="num">FC</th>
            <th className="num">FR</th>
            <th className="num">SpO₂</th>
            <th className="num">Temp.</th>
            <th className="num">Glic.</th>
            <th className="num">Dor</th>
            {onRemover && <th><span className="sr-only">Ações</span></th>}
          </tr>
        </thead>
        <tbody>
          {[...sinais].sort((a, b) => a.aferidoEm.localeCompare(b.aferidoEm)).map((s) => {
            const v = (c: CampoVital) => <td className={`num mono${vitalAlterado(c, s[c]) ? ' alterado' : ''}`}>{s[c] ?? '—'}</td>;
            return (
              <tr key={s.id}>
                <td className="mono">{fmtHora(s.aferidoEm)}</td>
                <td className={`num mono${vitalAlterado('paSistolica', s.paSistolica) || vitalAlterado('paDiastolica', s.paDiastolica) ? ' alterado' : ''}`}>
                  {s.paSistolica && s.paDiastolica ? `${s.paSistolica}/${s.paDiastolica}` : '—'}
                </td>
                {v('fc')}
                {v('fr')}
                {v('spo2')}
                {v('temperatura')}
                {v('glicemia')}
                {v('dor')}
                {onRemover && (
                  <td>
                    <button type="button" className="btn btn-fantasma" aria-label="Remover aferição" onClick={() => onRemover(s.id)}>
                      <Trash2 aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NovoSinal({ onAdicionar }: { onAdicionar: (s: SinalVital) => void }) {
  const [valores, setValores] = useState<Partial<Record<CampoVital, string>>>({});
  const [hora, setHora] = useState(() => paraInputLocal(new Date().toISOString()));
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = () => {
    const num = (c: CampoVital) => (valores[c] ? Number(valores[c]!.replace(',', '.')) : null);
    const s = { id: novoId(), aferidoEm: deInputLocal(hora), ...Object.fromEntries(CAMPOS_VITAIS.map((c) => [c, num(c)])) };
    const r = sinalVitalSchema.safeParse(s);
    if (!r.success) {
      setErro(r.error.issues[0]?.message ?? 'Verifique os valores.');
      return;
    }
    onAdicionar(r.data as SinalVital);
    setValores({});
    setErro(null);
    setHora(paraInputLocal(new Date().toISOString()));
  };

  return (
    <div className="painel-interno">
      <h3>Nova aferição</h3>
      <div className="grade-vitais">
        {CAMPOS_VITAIS.map((c) => {
          const f = FAIXAS_VITAIS[c];
          const v = valores[c];
          const alterado = v ? vitalAlterado(c, Number(v.replace(',', '.'))) : false;
          return (
            <div key={c} className="campo">
              <label htmlFor={`v-${c}`} title={f.rotulo}>{ROTULO_CURTO[c]}</label>
              <div className="unidade">
                <input
                  id={`v-${c}`}
                  className="mono"
                  inputMode="decimal"
                  value={v ?? ''}
                  onChange={(e) => setValores((x) => ({ ...x, [c]: e.target.value }))}
                  data-alterado={alterado || undefined}
                />
                <span>{f.unidade}</span>
              </div>
            </div>
          );
        })}
        <div className="campo">
          <label htmlFor="v-hora">Hora</label>
          <input id="v-hora" type="datetime-local" className="mono" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      </div>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
      <button type="button" className="btn" onClick={adicionar} disabled={!Object.values(valores).some(Boolean)}>
        <Plus aria-hidden /> Registrar aferição
      </button>
    </div>
  );
}

/* ------------------------------ Medicamentos ------------------------------ */

function NovaAdministracao({
  catalogo,
  alergias,
  anteriores,
  onAdicionar,
  atendimentoId,
}: {
  catalogo: Medicamento[];
  alergias: string[];
  anteriores: AdministracaoMedicamento[];
  onAdicionar: (m: AdministracaoMedicamento) => void;
  atendimentoId: string;
}) {
  const [medId, setMedId] = useState('');
  const [dose, setDose] = useState('');
  const [via, setVia] = useState<ViaAdministracao | ''>('');
  const [hora, setHora] = useState(() => paraInputLocal(new Date().toISOString()));
  const [observacao, setObservacao] = useState('');
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const exibidos = useRef(new Set<string>());

  const med = catalogo.find((m) => m.id === medId);
  const doseNum = Number(dose.replace(',', '.'));
  const papel = sessao.get()?.profissional.papel;

  const alertas = useMemo(() => {
    if (!med || !via || !(doseNum > 0)) return [];
    return avaliarAdministracao({
      medicamento: med,
      dose: doseNum,
      via,
      administradoEm: deInputLocal(hora),
      alergias,
      administracoesAnteriores: anteriores,
      papel,
    });
  }, [med, via, doseNum, hora, alergias, anteriores, papel]);

  const ignorados: AlertaIgnorado[] = alertas
    .filter((a) => a.ignoravel && justificativas[a.codigo]?.trim())
    .map((a) => ({ codigo: a.codigo, justificativa: justificativas[a.codigo].trim() }));
  const impeditivos = alertasImpeditivos(alertas, ignorados);

  useEffect(() => {
    for (const a of alertas) {
      const chave = `${medId}:${a.codigo}`;
      if (exibidos.current.has(chave)) continue;
      exibidos.current.add(chave);
      void registrarLog('ALERTA_CLINICO_EXIBIDO', 'ATENDIMENTO', atendimentoId, { codigo: a.codigo, medicamento: med?.nome }, 'WARN');
    }
  }, [alertas, medId, med?.nome, atendimentoId]);

  const escolher = (id: string) => {
    setMedId(id);
    const m = catalogo.find((x) => x.id === id);
    setVia(m?.viasPermitidas.length === 1 ? m.viasPermitidas[0] : '');
    setJustificativas({});
  };

  const adicionar = () => {
    if (!med || !via || impeditivos.length) return;
    const profissional = sessao.get()!.profissional;
    onAdicionar({
      id: novoId(),
      medicamentoId: med.id,
      dose: doseNum,
      unidade: med.unidade,
      via,
      administradoEm: deInputLocal(hora),
      administradoPor: profissional.id,
      observacao: observacao.trim() || null,
      alertasIgnorados: ignorados,
    });
    if (ignorados.length) {
      void registrarLog('ALERTA_CLINICO_IGNORADO', 'ATENDIMENTO', atendimentoId, { medicamento: med.nome, alertas: ignorados.map((i) => i.codigo) }, 'WARN');
    }
    setMedId('');
    setDose('');
    setVia('');
    setObservacao('');
    setJustificativas({});
    setHora(paraInputLocal(new Date().toISOString()));
  };

  if (catalogo.length === 0) {
    return (
      <div className="vazio">
        <strong>Catálogo de medicamentos vazio neste aparelho.</strong>
        <p>Receba os dados da central (aba Sincronização) para registrar medicamentos com as regras de segurança.</p>
      </div>
    );
  }

  return (
    <div className="painel-interno">
      <h3>Administrar medicamento</h3>
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="m-med">Medicamento</label>
          <select id="m-med" value={medId} onChange={(e) => escolher(e.target.value)}>
            <option value="">Escolha…</option>
            {catalogo.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} — {m.apresentacao}
              </option>
            ))}
          </select>
          {med && <span className="ajuda">Dose máxima por administração: <span className="mono">{med.doseMaximaDose} {med.unidade}</span>{med.controlado ? ' · controlado' : ''}</span>}
        </div>
        <div className="grade-2 compacta">
          <div className="campo">
            <label htmlFor="m-dose">Dose</label>
            <div className="unidade">
              <input id="m-dose" className="mono" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} disabled={!med} />
              <span>{med?.unidade ?? ''}</span>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="m-via">Via</label>
            <select id="m-via" value={via} onChange={(e) => setVia(e.target.value as ViaAdministracao)} disabled={!med}>
              <option value="">—</option>
              {(med?.viasPermitidas ?? []).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="m-hora">Hora</label>
          <input id="m-hora" type="datetime-local" className="mono" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="m-obs">Observação <span className="opcional">(opcional)</span></label>
          <input id="m-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="alertas-clinicos" role="alert">
          {alertas.map((a) => (
            <div key={a.codigo} className={`alerta ${a.severidade === 'BLOQUEANTE' ? 'alerta-erro' : 'alerta-aviso'}`}>
              <AlertTriangle aria-hidden />
              <div>
                <strong>{a.severidade === 'BLOQUEANTE' ? (a.ignoravel ? 'Atenção — exige justificativa' : 'Registro bloqueado') : 'Aviso'}</strong>
                <p>{a.mensagem}</p>
                {a.ignoravel && a.severidade === 'BLOQUEANTE' && (
                  <div className="campo">
                    <label htmlFor={`j-${a.codigo}`}>Justificativa clínica para prosseguir</label>
                    <textarea
                      id={`j-${a.codigo}`}
                      value={justificativas[a.codigo] ?? ''}
                      onChange={(e) => setJustificativas((j) => ({ ...j, [a.codigo]: e.target.value }))}
                      placeholder="Quem autorizou e por quê (fica registrado na ficha)"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn" onClick={adicionar} disabled={!med || !via || !(doseNum > 0) || impeditivos.length > 0}>
        <Plus aria-hidden /> Registrar administração
      </button>
    </div>
  );
}
