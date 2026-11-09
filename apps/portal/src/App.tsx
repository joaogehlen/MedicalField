import { Navigate, Route, Routes } from 'react-router-dom';
import { useSessao } from './api';
import { Layout } from './components/Layout';
import { AtendimentoDetalhe } from './pages/AtendimentoDetalhe';
import { Atendimentos } from './pages/Atendimentos';
import { Auditoria } from './pages/Auditoria';
import { Cadastros } from './pages/Cadastros';
import { Entrar } from './pages/Entrar';
import { ProntuarioDetalhe, Prontuarios } from './pages/Prontuarios';

export function App() {
  const s = useSessao();
  if (!s) return <Entrar />;
  return (
    <Layout>
      <Routes>
        <Route path="/atendimentos" element={<Atendimentos />} />
        <Route path="/atendimentos/:id" element={<AtendimentoDetalhe />} />
        <Route path="/prontuarios" element={<Prontuarios />} />
        <Route path="/prontuarios/:id" element={<ProntuarioDetalhe />} />
        <Route path="/cadastros" element={<Cadastros />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="*" element={<Navigate to="/atendimentos" replace />} />
      </Routes>
    </Layout>
  );
}
