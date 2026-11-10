import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { ZodError } from 'zod';
import { normalizarTexto, ROTULO_CLASSIFICACAO, significadoClassificacao, type Triagem } from '@medicalfield/shared';
import type { SyncStatus } from '../data/db';

export function Marca({ texto = true }: { texto?: boolean }) {
  return (
    <span className="marca">
      <svg className="marca-cruz" viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#d0263a" />
        <path d="M10 5h4v5h5v4h-5v5h-4v-5H5v-4h5z" fill="#fff" />
      </svg>
      {texto && <span>MedicalField</span>}
    </span>
  );
}

/** Classificação de risco: cor + nome escrito. */
export function TagTriagem({ triagem, completa }: { triagem: Triagem; completa?: boolean }) {
  return (
    <span className="triagem" data-cor={triagem.classificacao}>
      {ROTULO_CLASSIFICACAO[triagem.classificacao]}
      {completa && <span className="fw-normal">· {significadoClassificacao(triagem.protocolo, triagem.classificacao)}</span>}
    </span>
  );
}

export function SeloSync({ status, offline }: { status: SyncStatus; offline?: boolean }) {
  return (
    <span className="d-inline-flex gap-1 flex-wrap">
      {offline && <span className="badge rounded-pill badge-offline">Registrado offline</span>}
      {status === 'SINCRONIZADO' ? (
        <span className="badge rounded-pill text-bg-success"><i className="bi bi-cloud-check" /> Na central</span>
      ) : status === 'ERRO' ? (
        <span className="badge rounded-pill text-bg-danger"><i className="bi bi-x-circle" /> Recusado</span>
      ) : (
        <span className="badge rounded-pill text-bg-warning"><i className="bi bi-hourglass-split" /> Só no aparelho</span>
      )}
    </span>
  );
}

/** Passos da nova ocorrência: vítima → prontuário → atendimento. */
export function Etapas({ atual }: { atual: 0 | 1 | 2 }) {
  return (
    <ol className="list-unstyled d-flex gap-2 flex-wrap mb-3">
      {['Vítima', 'Prontuário', 'Atendimento'].map((e, i) => (
        <li key={e} className={`badge rounded-pill px-3 py-2 ${i === atual ? 'text-bg-primary' : i < atual ? 'text-bg-success' : 'bg-white text-secondary border'}`}>
          {i < atual ? <i className="bi bi-check-lg" /> : `${i + 1}.`} {e}
        </li>
      ))}
    </ol>
  );
}

export function mensagensDoErro(e: unknown): string[] {
  if (e instanceof ZodError) return [...new Set(e.issues.map((i) => i.message))];
  return [e instanceof Error ? e.message : 'Não foi possível salvar.'];
}

export function Erros({ lista }: { lista: string[] }) {
  if (!lista.length) return null;
  return (
    <div className="alert alert-danger d-flex gap-2" role="alert">
      <i className="bi bi-exclamation-triangle-fill" />
      <div>
        <strong>Revise antes de salvar</strong>
        <ul className="mb-0 ps-3">{lista.map((m) => <li key={m}>{m}</li>)}</ul>
      </div>
    </div>
  );
}

/** Lista de termos (alergias, comorbidades) com sugestões rápidas. */
export function Termos({ id, rotulo, valor, onChange, sugestoes = [] }: { id: string; rotulo: string; valor: string[]; onChange: (v: string[]) => void; sugestoes?: string[] }) {
  const [texto, setTexto] = useState('');
  const tem = (t: string) => valor.some((v) => normalizarTexto(v) === normalizarTexto(t));
  const adicionar = (t: string) => {
    if (t.trim() && !tem(t)) onChange([...valor, t.trim()]);
    setTexto('');
  };
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      adicionar(texto);
    }
  };
  return (
    <div>
      <label className="form-label" htmlFor={id}>{rotulo}</label>
      {valor.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {valor.map((v) => (
            <span key={v} className="badge rounded-pill text-bg-light border fs-6 fw-normal d-inline-flex align-items-center gap-1">
              {v}
              <button type="button" className="btn-close btn-close-sm" style={{ fontSize: '0.6rem' }} aria-label={`Remover ${v}`} onClick={() => onChange(valor.filter((x) => x !== v))} />
            </span>
          ))}
        </div>
      )}
      <div className="input-group">
        <input id={id} className="form-control" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={tecla} placeholder="Digite e tecle Enter" />
        <button type="button" className="btn btn-outline-secondary" onClick={() => adicionar(texto)} disabled={!texto.trim()}>Adicionar</button>
      </div>
      <div className="d-flex flex-wrap gap-1 mt-2">
        {sugestoes.filter((s) => !tem(s)).map((s) => (
          <button key={s} type="button" className="btn btn-sm btn-light border" onClick={() => adicionar(s)}>+ {s}</button>
        ))}
      </div>
    </div>
  );
}

export function Vazio({ icone, titulo, children }: { icone: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <i className={`bi ${icone}`} />
      <p className="fw-bold text-body mt-2 mb-1">{titulo}</p>
      {children}
    </div>
  );
}
