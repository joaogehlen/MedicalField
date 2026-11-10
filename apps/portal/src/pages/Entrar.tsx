import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import interior from '@medicalfield/design/img/interior.jpg';
import { CREDITOS } from '@medicalfield/design/img/creditos';
import { entrar } from '../api';
import { Marca } from '../ui';

export function Entrar() {
  const navegar = useNavigate();
  const [numero, setNumero] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar({ tipoRegistro: 'SOCORRISTA', numeroRegistro: numero.trim(), uf: null, senha });
      navegar('/atendimentos');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container-fluid p-0">
      <div className="row g-0 min-vh-100">
        <div className="col-lg-5 d-flex align-items-center bg-white order-2 order-lg-1">
          <form className="w-100 p-4 p-md-5" style={{ maxWidth: 460, margin: '0 auto' }} onSubmit={enviar} noValidate>
            <div className="mb-4"><Marca /></div>
            <h1 className="h3 mb-1">Portal da central</h1>
            <p className="text-secondary mb-4">Acompanhe os atendimentos, gere a ficha em PDF e envie aos familiares.</p>
            <div className="mb-3">
              <label className="form-label" htmlFor="numero">Registro do administrador</label>
              <input id="numero" className="form-control form-control-lg font-monospace" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0001" />
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
        <div className="col-lg-7 login-foto order-1 order-lg-2">
          <img src={interior} alt="Interior de uma ambulância do SAMU" className="foto-cover" />
          <div className="legenda">
            <p className="h4 mb-2 text-white">Tudo o que a equipe registrou em campo, num só lugar.</p>
            <p className="credito mb-0">Foto: {CREDITOS.interior}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
