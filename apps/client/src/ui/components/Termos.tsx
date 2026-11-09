import { X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { normalizarTexto } from '@medicalfield/shared';

/** Lista de termos (alergias, comorbidades, procedimentos) com sugestões rápidas. */
export function Termos({
  rotulo,
  valor,
  onChange,
  sugestoes = [],
  placeholder,
  ajuda,
}: {
  rotulo: string;
  valor: string[];
  onChange: (v: string[]) => void;
  sugestoes?: string[];
  placeholder?: string;
  ajuda?: string;
}) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const tem = (t: string) => valor.some((v) => normalizarTexto(v) === normalizarTexto(t));
  const adicionar = (t: string) => {
    const limpo = t.trim();
    if (limpo && !tem(limpo)) onChange([...valor, limpo]);
    setTexto('');
  };
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      adicionar(texto);
    } else if (e.key === 'Backspace' && !texto && valor.length) {
      onChange(valor.slice(0, -1));
    }
  };
  const livres = sugestoes.filter((s) => !tem(s));
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {valor.length > 0 && (
        <ul className="termos" aria-label={rotulo}>
          {valor.map((v) => (
            <li key={v}>
              {v}
              <button type="button" onClick={() => onChange(valor.filter((x) => x !== v))} aria-label={`Remover ${v}`}>
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="termos-entrada">
        <input
          id={id}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={tecla}
          onBlur={() => texto && adicionar(texto)}
          placeholder={placeholder}
          enterKeyHint="done"
        />
        <button type="button" className="btn" onClick={() => adicionar(texto)} disabled={!texto.trim()}>
          Adicionar
        </button>
      </div>
      {livres.length > 0 && (
        <div className="sugestoes" aria-label="Sugestões">
          {livres.map((s) => (
            <button key={s} type="button" onClick={() => adicionar(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
      {ajuda && <span className="ajuda">{ajuda}</span>}
    </div>
  );
}
