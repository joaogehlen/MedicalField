import { Fragment, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LoginResponse, TipoRegistro } from '@medicalfield/shared';
import { api } from '../../api/client';
import { sessao } from '../../auth/session';
import { syncEngine } from '../../sync/engine';
import { fotoLogin } from '../imagens';
import { Marca } from '../components';
import { ChaveRede } from '../Layout';

export function Entrar() {
  const navegar = useNavigate();
  const [tipo, setTipo] = useState<TipoRegistro>('CRM');
  const [numero, setNumero] = useState('');
  const [uf, setUf] = useState('RS');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await api<LoginResponse>('POST', '/auth/login', { tipoRegistro: tipo, numeroRegistro: numero.trim(), uf: tipo === 'SOCORRISTA' ? null : uf, senha });
      sessao.entrar(r);
      void syncEngine.sincronizar();
      navegar('/');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container-fluid p-0">
      <div className="row g-0 min-vh-100">
        <div className="col-lg-7 login-foto">
          <img src={fotoLogin.src} alt={fotoLogin.alt} className="foto-cover" />
          <div className="legenda">
            <h1 className="display-6 mb-2">Ficha de atendimento que não espera a rede.</h1>
            <p className="lead mb-3 opacity-75">Registre sinais vitais, triagem e medicamentos no local da ocorrência. Quando o sinal voltar, tudo segue para a central.</p>
            <p className="credito mb-0">Foto: {fotoLogin.credito}</p>
          </div>
        </div>
        <div className="col-lg-5 d-flex align-items-center bg-white">
          <form className="w-100 p-4 p-md-5" style={{ maxWidth: 480, margin: '0 auto' }} onSubmit={entrar} noValidate>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Marca />
              <ChaveRede />
            </div>
            <h2 className="h3 mb-1">Entrar no plantão</h2>
            <p className="text-secondary mb-4">Use seu registro profissional.</p>

            <label className="form-label">Tipo de registro</label>
            <div className="btn-group w-100 mb-3" role="group">
              {(['CRM', 'COREN', 'SOCORRISTA'] as const).map((t) => (
                <Fragment key={t}>
                  <input type="radio" className="btn-check" name="tipo" id={`tipo-${t}`} checked={tipo === t} onChange={() => setTipo(t)} />
                  <label className="btn btn-outline-primary" htmlFor={`tipo-${t}`}>{t === 'SOCORRISTA' ? 'Socorrista' : t}</label>
                </Fragment>
              ))}
            </div>

            <div className="row g-3 mb-3">
              <div className={tipo === 'SOCORRISTA' ? 'col-12' : 'col-8'}>
                <label className="form-label" htmlFor="numero">Número</label>
                <input id="numero" className="form-control form-control-lg font-monospace" inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value)} />
              </div>
              {tipo !== 'SOCORRISTA' && (
                <div className="col-4">
                  <label className="form-label" htmlFor="uf">UF</label>
                  <input id="uf" className="form-control form-control-lg font-monospace" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="senha">Senha</label>
              <input id="senha" type="password" className="form-control form-control-lg" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>

            {erro && <div className="alert alert-danger py-2" role="alert">{erro}</div>}
            <button type="submit" className="btn btn-primary btn-lg w-100" disabled={!numero || !senha || enviando}>
              {enviando && <span className="spinner-border spinner-border-sm me-2" />}Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
