import { useState } from 'react';
import type { Hospital, Medicamento, Profissional, Viatura } from '@medicalfield/shared';
import { useApi } from '../api';
import { Cabeca, Carregando, Erro } from '../components/ui';

const ABAS = [
  { id: 'medicamentos', rotulo: 'Medicamentos' },
  { id: 'profissionais', rotulo: 'Profissionais' },
  { id: 'hospitais', rotulo: 'Hospitais' },
  { id: 'viaturas', rotulo: 'Viaturas' },
] as const;
type Aba = (typeof ABAS)[number]['id'];

const PAPEL = { MEDICO: 'Médico', ENFERMEIRO: 'Enfermeiro', SOCORRISTA: 'Socorrista', ADMIN: 'Regulação (admin)' } as const;

export function Cadastros() {
  const [aba, setAba] = useState<Aba>('medicamentos');
  return (
    <div className="pagina">
      <Cabeca titulo="Cadastros de apoio" sub="Somente leitura. Inclusões e alterações são feitas direto no banco de dados e chegam aos dispositivos no próximo recebimento." />
      <div className="abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}>{a.rotulo}</button>
        ))}
      </div>
      <div role="tabpanel">
        {aba === 'medicamentos' && <Medicamentos />}
        {aba === 'profissionais' && <Profissionais />}
        {aba === 'hospitais' && <Hospitais />}
        {aba === 'viaturas' && <Viaturas />}
      </div>
    </div>
  );
}

function Medicamentos() {
  const { dados, erro, carregando, recarregar } = useApi<Medicamento[]>('/medicamento?incluirInativos=true');
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;
  return (
    <>
      <div className="barra-tabela">
        <span className="fraco">{dados.length} medicamentos</span>
        <button type="button" className="btn" onClick={() => void recarregar()} data-carregando={carregando}>Atualizar</button>
      </div>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead><tr><th>Nome</th><th>Apresentação</th><th>Vias</th><th className="num">Dose máx.</th><th className="num">Máx. diária</th><th className="num">Intervalo</th><th>Alérgenos</th><th>Situação</th></tr></thead>
          <tbody>
            {dados.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.nome}</strong><div className="fraco">{m.principioAtivo}{m.controlado ? ' · controlado' : ''}</div></td>
                <td>{m.apresentacao}</td>
                <td className="mono">{m.viasPermitidas.join(', ')}</td>
                <td className="num mono">{m.doseMaximaDose} {m.unidade}</td>
                <td className="num mono">{m.doseMaximaDiaria ? `${m.doseMaximaDiaria} ${m.unidade}` : '—'}</td>
                <td className="num mono">{m.intervaloMinimoHoras ? `${m.intervaloMinimoHoras} h` : '—'}</td>
                <td className="truncar">{m.alergenos.join(', ') || '—'}</td>
                <td>{m.ativo ? <span className="selo selo-ok">Ativo</span> : <span className="selo">Inativo</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Profissionais() {
  const { dados, erro } = useApi<Profissional[]>('/profissional');
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead><tr><th>Nome</th><th>Registro</th><th>Perfil</th><th>E-mail</th><th>Situação</th></tr></thead>
        <tbody>
          {dados.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.nome}</strong></td>
              <td className="mono">{p.tipoRegistro} {p.numeroRegistro}{p.uf ? `/${p.uf}` : ''}</td>
              <td>{PAPEL[p.papel]}</td>
              <td>{p.email ?? '—'}</td>
              <td>{p.ativo ? <span className="selo selo-ok">Ativo</span> : <span className="selo">Inativo</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Hospitais() {
  const { dados, erro } = useApi<Hospital[]>('/apoio/hospital');
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead><tr><th>Hospital</th><th>Cidade</th><th>Telefone</th><th>Situação</th></tr></thead>
        <tbody>
          {dados.map((h) => (
            <tr key={h.id}><td><strong>{h.nome}</strong></td><td>{h.cidade}</td><td className="mono">{h.telefone ?? '—'}</td><td>{h.ativo ? <span className="selo selo-ok">Ativo</span> : <span className="selo">Inativo</span>}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Viaturas() {
  const { dados, erro } = useApi<Viatura[]>('/apoio/viatura');
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;
  const TIPO = { USA: 'Suporte avançado', USB: 'Suporte básico', RESGATE: 'Resgate' } as const;
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead><tr><th>Prefixo</th><th>Tipo</th><th>Base</th><th>Situação</th></tr></thead>
        <tbody>
          {dados.map((v) => (
            <tr key={v.id}><td className="mono"><strong>{v.prefixo}</strong></td><td>{TIPO[v.tipo]}</td><td>{v.base}</td><td>{v.ativo ? <span className="selo selo-ok">Ativa</span> : <span className="selo">Inativa</span>}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
