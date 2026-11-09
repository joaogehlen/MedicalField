import { AlertTriangle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { TipoRegistro } from '@medicalfield/shared';
import { entrar } from '../api';

export function Entrar() {
  const [tipo, setTipo] = useState<TipoRegistro>('SOCORRISTA');
  const [numero, setNumero] = useState('');
  const [uf, setUf] = useState('RS');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar({ tipoRegistro: tipo, numeroRegistro: numero.trim(), uf: tipo === 'SOCORRISTA' ? null : uf, senha });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="entrar">
      <div className="entrar-marca">
        <div className="marca">
          <svg viewBox="0 0 24 24" aria-hidden className="marca-cruz"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
          <span>MedicalField</span>
        </div>
        <h1>Central de regulação</h1>
        <p>Atendimentos pré-hospitalares recebidos das equipes, prontuários, cadastros de apoio e auditoria de acessos.</p>
      </div>
      <form className="painel entrar-form" onSubmit={enviar} noValidate>
        <h2>Entrar</h2>
        <div className="campo">
          <label htmlFor="tipo">Tipo de registro</label>
          <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoRegistro)}>
            <option value="SOCORRISTA">ID Socorrista</option>
            <option value="CRM">CRM</option>
            <option value="COREN">COREN</option>
          </select>
        </div>
        <div className={tipo === 'SOCORRISTA' ? '' : 'linha-2-1'}>
          <div className="campo">
            <label htmlFor="numero">Número</label>
            <input id="numero" className="mono" autoComplete="username" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          {tipo !== 'SOCORRISTA' && (
            <div className="campo">
              <label htmlFor="uf">UF</label>
              <input id="uf" className="mono" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
            </div>
          )}
        </div>
        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && (
          <div className="alerta alerta-erro" role="alert">
            <AlertTriangle aria-hidden />
            <p>{erro}</p>
          </div>
        )}
        <button type="submit" className="btn btn-primario btn-grande btn-bloco" data-carregando={enviando} disabled={!numero || !senha}>
          Entrar
        </button>
      </form>
    </div>
  );
}
