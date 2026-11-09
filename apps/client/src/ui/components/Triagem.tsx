import { significadoClassificacao, INFO_CLASSIFICACAO, type Triagem } from '@medicalfield/shared';

/** Etiqueta de triagem com ilhós: cor + nome escrito (cor nunca é o único sinal). */
export function TagTriagem({ triagem, grande, comSignificado }: { triagem: Triagem; grande?: boolean; comSignificado?: boolean }) {
  const { rotulo } = INFO_CLASSIFICACAO[triagem.classificacao];
  const sig = significadoClassificacao(triagem.protocolo, triagem.classificacao);
  return (
    <span className={`tag-triagem${grande ? ' grande' : ''}`} data-cor={triagem.classificacao} title={`${triagem.protocolo} · ${sig}`}>
      {rotulo}
      {comSignificado && <span style={{ fontWeight: 400 }}>· {sig}</span>}
    </span>
  );
}
