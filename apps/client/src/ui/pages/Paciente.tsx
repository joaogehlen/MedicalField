import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { local } from '../../data/repositories';
import { SeloSync, TagTriagem } from '../components';
import { fmtCpf, fmtData, fmtDataHora, idade } from '../format';

const SEXO = { M: 'Masculino', F: 'Feminino', O: 'Outro' } as const;

export function Paciente() {
  const { id = '' } = useParams();
  const dados = useLiveQuery(async () => {
    const [pessoa, prontuario, atendimentos] = await Promise.all([local.pessoas.buscar(id), local.prontuarios.daPessoa(id), local.atendimentos.daPessoa(id)]);
    return { pessoa, prontuario, atendimentos };
  }, [id]);
  if (!dados) return null;
  const { pessoa, prontuario, atendimentos } = dados;
  if (!pessoa) return <div className="alert alert-secondary">Paciente não encontrado neste aparelho.</div>;

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h1 className="h3 mb-1">{pessoa.nome}</h1>
          <div className="text-secondary font-monospace">{fmtCpf(pessoa.cpf)}{idade(pessoa.dataNascimento) ? ` · ${idade(pessoa.dataNascimento)}` : ''}</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to={`/paciente/${pessoa.id}/editar`} className="btn btn-outline-secondary"><i className="bi bi-pencil me-1" />Dados</Link>
          <Link to={`/paciente/${pessoa.id}/prontuario`} className="btn btn-outline-secondary"><i className="bi bi-journal-medical me-1" />{prontuario ? 'Prontuário' : 'Abrir prontuário'}</Link>
          {prontuario && <Link to={`/paciente/${pessoa.id}/atendimento`} className="btn btn-primary"><i className="bi bi-plus-lg me-1" />Novo atendimento</Link>}
        </div>
      </div>

      {prontuario?.alergias.length ? <div className="alergias mb-3"><i className="bi bi-exclamation-octagon-fill" />Alergias: {prontuario.alergias.join(', ')}</div> : null}

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between">Identificação <SeloSync status={pessoa.syncStatus} offline={pessoa.criadoOffline} /></div>
            <div className="card-body row g-3 small">
              <div className="col-6"><div className="text-secondary">Nascimento</div><div className="fw-bold">{fmtData(pessoa.dataNascimento)}</div></div>
              <div className="col-6"><div className="text-secondary">Sexo</div><div className="fw-bold">{pessoa.sexo ? SEXO[pessoa.sexo] : '—'}</div></div>
              <div className="col-6"><div className="text-secondary">Telefone</div><div className="fw-bold">{pessoa.telefone ?? '—'}</div></div>
              <div className="col-6"><div className="text-secondary">E-mail</div><div className="fw-bold text-break">{pessoa.email ?? '—'}</div></div>
              <div className="col-12"><div className="text-secondary">Contato (familiar)</div><div className="fw-bold">{[pessoa.contatoNome, pessoa.contatoEmail].filter(Boolean).join(' · ') || '—'}</div></div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">Prontuário</div>
            <div className="card-body small">
              {prontuario ? (
                <div className="row g-3">
                  <div className="col-6"><div className="text-secondary">Tipo sanguíneo</div><div className="fw-bold">{prontuario.tipoSanguineo ?? '—'}</div></div>
                  <div className="col-6"><div className="text-secondary">Comorbidades</div><div className="fw-bold">{prontuario.comorbidades.join(', ') || '—'}</div></div>
                  {prontuario.observacoes && <div className="col-12"><div className="text-secondary">Observações</div><div className="fw-bold">{prontuario.observacoes}</div></div>}
                </div>
              ) : (
                <p className="text-secondary mb-0">Ainda sem prontuário. Abra o prontuário para registrar atendimentos.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5">Atendimentos</h2>
      {atendimentos.length === 0 ? (
        <p className="text-secondary">Nenhum atendimento registrado.</p>
      ) : (
        <div className="list-group shadow-sm">
          {atendimentos.map((a) => (
            <Link key={a.id} to={`/atendimento/${a.id}`} className="list-group-item list-group-item-action d-flex flex-wrap align-items-center gap-3 py-3">
              <TagTriagem triagem={a.triagem} />
              <div className="flex-grow-1"><div className="fw-bold">{a.queixaPrincipal}</div><div className="small text-secondary font-monospace">{fmtDataHora(a.dataHora)}</div></div>
              <SeloSync status={a.syncStatus} offline={a.criadoOffline} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
