import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { INFO_CLASSIFICACAO, significadoClassificacao, type Page, type Triagem } from '@medicalfield/shared';

export function TagTriagem({ triagem, grande, comSignificado }: { triagem: Triagem; grande?: boolean; comSignificado?: boolean }) {
  const sig = significadoClassificacao(triagem.protocolo, triagem.classificacao);
  return (
    <span className={`tag-triagem${grande ? ' grande' : ''}`} data-cor={triagem.classificacao} title={`${triagem.protocolo} · ${sig}`}>
      {INFO_CLASSIFICACAO[triagem.classificacao].rotulo}
      {comSignificado && <span style={{ fontWeight: 400 }}>· {sig}</span>}
    </span>
  );
}

export function SeloOffline() {
  return <span className="selo selo-offline">Registrado offline</span>;
}

/** Cabeçalho de página com ação de atualizar. */
export function Cabeca({ titulo, sub, children, onAtualizar, carregando }: { titulo: string; sub?: ReactNode; children?: ReactNode; onAtualizar?: () => void; carregando?: boolean }) {
  return (
    <div className="pagina-cabeca">
      <div>
        <h1>{titulo}</h1>
        {sub && <p className="subtitulo">{sub}</p>}
      </div>
      <div className="acoes">
        {children}
        {onAtualizar && (
          <button type="button" className="btn" onClick={onAtualizar} data-carregando={carregando}>
            <RefreshCw aria-hidden /> Atualizar
          </button>
        )}
      </div>
    </div>
  );
}

export function Erro({ mensagem }: { mensagem: string }) {
  return (
    <div className="alerta alerta-erro" role="alert">
      <AlertTriangle aria-hidden />
      <p>{mensagem}</p>
    </div>
  );
}

export function Carregando({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="carregando" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esqueleto" style={{ height: 38 }} />
      ))}
    </div>
  );
}

export function Paginacao<T>({ page, onPagina }: { page: Page<T>; onPagina: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(page.total / page.tamanho));
  if (page.total === 0) return null;
  const de = (page.pagina - 1) * page.tamanho + 1;
  return (
    <div className="paginacao">
      <span className="mono">
        {de}–{Math.min(page.total, de + page.itens.length - 1)} de {page.total}
      </span>
      <button type="button" className="btn btn-fantasma" disabled={page.pagina <= 1} onClick={() => onPagina(page.pagina - 1)} aria-label="Página anterior">
        <ChevronLeft aria-hidden />
      </button>
      <button type="button" className="btn btn-fantasma" disabled={page.pagina >= paginas} onClick={() => onPagina(page.pagina + 1)} aria-label="Próxima página">
        <ChevronRight aria-hidden />
      </button>
    </div>
  );
}
