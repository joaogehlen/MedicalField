/**
 * Serviços de aplicação do registro clínico. Regra de ouro do offline-first: toda
 * escrita vai para o banco local E gera um Command na Outbox, na mesma transação.
 * Estando online, o SyncEngine drena a Outbox logo em seguida.
 */
import type { Atendimento, Pessoa, Prontuario } from '@medicalfield/shared';
import { atendimentoSchema, pessoaSchema, prontuarioSchema } from '@medicalfield/shared';
import { dispositivoId, novoId } from '../api/client';
import { sessao } from '../auth/session';
import { db, type OperacaoOutbox, type TipoOperacao } from '../data/db';
import { network } from '../sync/network';
import { syncEngine } from '../sync/engine';
import { registrarLog } from './logs';

type Novo<T> = Omit<T, 'atualizadoEmCliente' | 'registradoPor' | 'dispositivoId' | 'version' | 'changeSeq' | 'baseVersion'>;

function meta(existente?: { version?: number; registradoPor?: string; criadoOffline?: boolean }) {
  const profissional = sessao.get()?.profissional;
  if (!profissional) throw new Error('Nenhum profissional autenticado.');
  return {
    atualizadoEmCliente: new Date().toISOString(),
    registradoPor: existente?.registradoPor ?? profissional.id,
    dispositivoId: dispositivoId(),
    criadoOffline: existente ? !!existente.criadoOffline : !network.isOnline(),
  };
}

async function enfileirar(tipo: TipoOperacao, entidadeId: string, payload: unknown) {
  // Coalescência: se já existe operação pendente para o mesmo registro, ela enviará
  // o estado mais recente — não é preciso enfileirar outra.
  const pendente = await db.outbox
    .where('entidadeId')
    .equals(entidadeId)
    .filter((o) => o.tipo === tipo && (o.status === 'PENDENTE' || o.status === 'ERRO'))
    .first();
  if (pendente) {
    // Se a operação já foi tentada, o servidor pode tê-la processado: uma chave nova
    // garante que o estado novo não seja respondido com a resposta antiga (replay).
    const novaChave = pendente.tentativas > 0 ? { opId: novoId(), tentativas: 0 } : {};
    await db.outbox.update(pendente.seq!, { payload, status: 'PENDENTE', ultimoErro: null, ...novaChave });
    return;
  }
  const op: OperacaoOutbox = {
    opId: novoId(),
    tipo,
    entidadeId,
    payload,
    status: 'PENDENTE',
    tentativas: 0,
    criadoEm: new Date().toISOString(),
  };
  await db.outbox.add(op);
}

export async function salvarPessoa(dados: Novo<Pessoa>): Promise<Pessoa> {
  const existente = await db.pessoas.get(dados.id);
  const pessoa = pessoaSchema.parse({ ...dados, ...meta(existente) }) as Pessoa;
  const registro = { ...existente, ...pessoa, version: existente?.version, changeSeq: existente?.changeSeq };
  await db.transaction('rw', db.pessoas, db.outbox, async () => {
    await db.pessoas.put({ ...registro, syncStatus: 'PENDENTE', syncErro: null });
    await enfileirar('UPSERT_PESSOA', pessoa.id, registro);
  });
  await registrarLog(existente ? 'PESSOA_ALTERADA' : 'PESSOA_CRIADA', 'PESSOA', pessoa.id);
  syncEngine.solicitar();
  return registro;
}

export async function salvarProntuario(dados: Novo<Prontuario>): Promise<Prontuario> {
  const existente = await db.prontuarios.get(dados.id);
  const prontuario = prontuarioSchema.parse({ ...dados, ...meta(existente) }) as Prontuario;
  const registro = { ...existente, ...prontuario, version: existente?.version, changeSeq: existente?.changeSeq };
  await db.transaction('rw', db.prontuarios, db.outbox, async () => {
    await db.prontuarios.put({ ...registro, syncStatus: 'PENDENTE', syncErro: null });
    await enfileirar('UPSERT_PRONTUARIO', prontuario.id, registro);
  });
  await registrarLog(existente ? 'PRONTUARIO_ALTERADO' : 'PRONTUARIO_CRIADO', 'PRONTUARIO', prontuario.id);
  syncEngine.solicitar();
  return registro;
}

export async function salvarAtendimento(dados: Novo<Atendimento>): Promise<Atendimento> {
  const existente = await db.atendimentos.get(dados.id);
  if (existente?.status === 'FINALIZADO') throw new Error('Atendimento finalizado não pode ser alterado.');
  const atendimento = atendimentoSchema.parse({ ...dados, ...meta(existente) }) as Atendimento;
  const registro = { ...existente, ...atendimento, version: existente?.version, changeSeq: existente?.changeSeq };
  await db.transaction('rw', db.atendimentos, db.outbox, async () => {
    await db.atendimentos.put({ ...registro, syncStatus: 'PENDENTE', syncErro: null });
    await enfileirar('UPSERT_ATENDIMENTO', atendimento.id, registro);
  });
  const acao = atendimento.status === 'FINALIZADO' ? 'ATENDIMENTO_FINALIZADO' : existente ? 'ATENDIMENTO_ALTERADO' : 'ATENDIMENTO_CRIADO';
  await registrarLog(acao, 'ATENDIMENTO', atendimento.id, {
    classificacao: atendimento.triagem.classificacao,
    medicamentos: atendimento.medicamentos.length,
  });
  syncEngine.solicitar();
  return registro;
}

export { novoId };
