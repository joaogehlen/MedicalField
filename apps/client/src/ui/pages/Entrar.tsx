import { AlertTriangle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LoginRequest, LoginResponse, TipoRegistro } from '@medicalfield/shared';
import { api, ApiError, dispositivoId, NetworkUnavailableError } from '../../api/client';
import { guardarCredencial, sessao, validarOffline } from '../../auth/session';
import { registrarLog } from '../../services/logs';
import { syncEngine } from '../../sync/engine';
import { network } from '../../sync/network';
import { ChaveRede } from '../components/Casca';
import { useRede } from '../hooks';

const TIPOS: { valor: TipoRegistro; rotulo: string; exemplo: string }[] = [
  { valor: 'CRM', rotulo: 'CRM', exemplo: 'Médico' },
  { valor: 'COREN', rotulo: 'COREN', exemplo: 'Enfermagem' },
  { valor: 'SOCORRISTA', rotulo: 'ID Socorrista', exemplo: 'Resgate' },
];

export function Entrar() {
  const rede = useRede();
  const navegar = useNavigate();
  const [tipo, setTipo] = useState<TipoRegistro>('CRM');
  const [numero, setNumero] = useState('');
  const [uf, setUf] = useState('RS');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const precisaUf = tipo !== 'SOCORRISTA';

  async function entrarOffline(req: LoginRequest) {
    const r = await validarOffline(req);
    if (!r.ok) {
      setErro(r.motivo);
      return;
    }
    sessao.definir({ profissional: r.profissional, accessToken: null, refreshToken: r.refreshToken, expiraEm: null, modo: 'OFFLINE' });
    await registrarLog('LOGIN_OFFLINE', 'PROFISSIONAL', r.profissional.id);
    navegar('/');
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const req: LoginRequest = { tipoRegistro: tipo, numeroRegistro: numero.trim(), uf: precisaUf ? uf : null, senha, dispositivoId: dispositivoId() };
    try {
      if (!network.isOnline()) {
        await entrarOffline(req);
        return;
      }
      const r = await api<LoginResponse>('POST', '/auth/login', req, { semAuth: true });
      sessao.aplicarLogin(r);
      await guardarCredencial(req, r);
      await registrarLog('LOGIN_ONLINE', 'PROFISSIONAL', r.profissional.id);
      void syncEngine.sincronizar();
      navegar('/');
    } catch (err) {
      if (err instanceof NetworkUnavailableError) await entrarOffline(req);
      else if (err instanceof ApiError) setErro(err.message);
      else setErro('Não foi possível entrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-entrar" data-online={rede.online}>
      <header className="casca casca-entrar">
        <div className="casca-linha">
          <div className="marca">
            <svg viewBox="0 0 24 24" aria-hidden className="marca-cruz">
              <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
            </svg>
            <span>MedicalField</span>
          </div>
          <div className="casca-acoes">
            <ChaveRede />
          </div>
        </div>
        <div className="faixa-refletiva" aria-hidden />
      </header>

      <main className="entrar-corpo">
        <div className="entrar-cabeca">
          <h1>Entrar no plantão</h1>
          <p>Use o registro profissional. {rede.online ? 'Com conexão, o aparelho também fica liberado para entrar offline.' : 'Sem conexão: só entra quem já acessou este aparelho antes.'}</p>
        </div>

        <form className="painel entrar-form" onSubmit={enviar} noValidate>
          <fieldset className="segmentos">
            <legend>Tipo de registro</legend>
            {TIPOS.map((t) => (
              <label key={t.valor} className="segmento">
                <input type="radio" name="tipo" value={t.valor} checked={tipo === t.valor} onChange={() => setTipo(t.valor)} />
                <span>
                  {t.rotulo} <small>{t.exemplo}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div className={precisaUf ? 'linha-2-1' : ''}>
            <div className="campo">
              <label htmlFor="numero">Número do {tipo === 'SOCORRISTA' ? 'ID' : tipo}</label>
              <input id="numero" className="mono" inputMode="numeric" autoComplete="username" value={numero} onChange={(e) => setNumero(e.target.value)} required />
            </div>
            {precisaUf && (
              <div className="campo">
                <label htmlFor="uf">UF</label>
                <input id="uf" className="mono" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} required />
              </div>
            )}
          </div>

          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>

          {erro && (
            <div className="alerta alerta-erro" role="alert">
              <AlertTriangle aria-hidden />
              <p>{erro}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primario btn-grande btn-bloco" data-carregando={enviando} disabled={!numero || !senha}>
            {rede.online ? 'Entrar' : 'Entrar offline'}
          </button>
        </form>
      </main>
    </div>
  );
}
