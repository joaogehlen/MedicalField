const ETAPAS = ['Vítima', 'Prontuário', 'Atendimento'];

/** Indicador da nova ocorrência: vítima → prontuário → atendimento. */
export function Etapas({ atual }: { atual: 0 | 1 | 2 }) {
  return (
    <ol className="etapas" aria-label="Etapas da nova ocorrência">
      {ETAPAS.map((e, i) => (
        <li key={e} data-estado={i < atual ? 'feito' : i === atual ? 'atual' : 'futuro'} aria-current={i === atual ? 'step' : undefined}>
          <span className="mono">{i + 1}</span> {e}
        </li>
      ))}
    </ol>
  );
}
