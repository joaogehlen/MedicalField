import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useSessao } from './ui/hooks';
import { Layout } from './ui/Layout';
import { AtendimentoForm } from './ui/pages/AtendimentoForm';
import { AtendimentoVer } from './ui/pages/AtendimentoVer';
import { Entrar } from './ui/pages/Entrar';
import { Ocorrencias } from './ui/pages/Ocorrencias';
import { Paciente } from './ui/pages/Paciente';
import { Pacientes } from './ui/pages/Pacientes';
import { PessoaForm } from './ui/pages/PessoaForm';
import { ProntuarioForm } from './ui/pages/ProntuarioForm';
import { Sincronizacao } from './ui/pages/Sincronizacao';

function Protegido() {
  if (!useSessao()) return <Navigate to="/entrar" replace />;
  return <Layout><Outlet /></Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route element={<Protegido />}>
        <Route index element={<Ocorrencias />} />
        <Route path="pacientes" element={<Pacientes />} />
        <Route path="nova" element={<PessoaForm />} />
        <Route path="paciente/:id" element={<Paciente />} />
        <Route path="paciente/:id/editar" element={<PessoaForm />} />
        <Route path="paciente/:id/prontuario" element={<ProntuarioForm />} />
        <Route path="paciente/:id/atendimento" element={<AtendimentoForm />} />
        <Route path="atendimento/:id" element={<AtendimentoVer />} />
        <Route path="sincronizar" element={<Sincronizacao />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
