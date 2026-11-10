import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useSessao } from './api';
import { AtendimentoDetalhe } from './pages/AtendimentoDetalhe';
import { Atendimentos } from './pages/Atendimentos';
import { Cadastros } from './pages/Cadastros';
import { Entrar } from './pages/Entrar';
import { Prontuario, Prontuarios } from './pages/Prontuarios';
import { Layout } from './ui';

function Protegido() {
  if (!useSessao()) return <Navigate to="/entrar" replace />;
  return <Layout><Outlet /></Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route element={<Protegido />}>
        <Route index element={<Navigate to="/atendimentos" replace />} />
        <Route path="atendimentos" element={<Atendimentos />} />
        <Route path="atendimentos/:id" element={<AtendimentoDetalhe />} />
        <Route path="prontuarios" element={<Prontuarios />} />
        <Route path="prontuarios/:id" element={<Prontuario />} />
        <Route path="cadastros" element={<Cadastros />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
