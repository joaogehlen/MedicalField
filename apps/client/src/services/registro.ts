/**
 * Gravação dos registros clínicos. Regra do offline-first: toda escrita vai para o
 * banco do aparelho E para a Outbox na mesma transação; estando online, o SyncEngine
 * envia na hora.
 */
import type { Table } from 'dexie';
import { atendimentoSchema, pessoaSchema, prontuarioSchema, type Atendimento, type Pessoa, type Prontuario, type SyncMeta } from '@medicalfield/shared';
import type { ZodTypeAny } from 'zod';
import { dispositivoId, novoId } from '../api/client';
import { sessao } from '../auth/session';
import { db, type Local, type TipoOperacao } from '../data/db';
import { network } from '../sync/network';
import { syncEngine } from '../sync/engine';
import { registrarLog } from './logs';

type SemMeta<T> = Omit<T, 'atualizadoEmCliente' | 'registradoPor' | 'dispositivoId' | 'version' | 'changeSeq' | 'baseVersion'>;

async function gravar<T extends SyncMeta & { id: string }>(
  tipo: TipoOperacao,
  tabela: Table<T & Local, string>,
  schema: ZodTypeAny,
  dados: object & { id: string },
): Promise<T> {
  const existente = await tabela.get(dados.id);
  const validado = schema.parse({
    ...dados,
    atualizadoEmCliente: new Date().toISOString(),
    registradoPor: existente?.registradoPor ?? sessao.get()!.profissional.id,
    dispositivoId: dispositivoId(),
    criadoOffline: existente ? existente.criadoOffline : !network.isOnline(),
  }) as T;
  const registro = { ...validado, version: existente?.version };
  await db.transaction('rw', tabela, db.outbox, async () => {
    await tabela.put({ ...registro, syncStatus: 'PENDENTE' } as T & Local);
    await db.outbox.add({ opId: novoId(), tipo, entidadeId: registro.id, status: 'PENDENTE', criadoEm: new Date().toISOString() });
  });
  await registrarLog(`${tipo}_${existente ? 'ALTERADO' : 'CRIADO'}`, { id: registro.id });
  syncEngine.solicitar();
  return registro;
}

export const salvarPessoa = (p: SemMeta<Pessoa>) => gravar<Pessoa>('PESSOA', db.pessoas, pessoaSchema, p);
export const salvarProntuario = (p: SemMeta<Prontuario>) => gravar<Prontuario>('PRONTUARIO', db.prontuarios, prontuarioSchema, p);
export const salvarAtendimento = (a: SemMeta<Atendimento>) => gravar<Atendimento>('ATENDIMENTO', db.atendimentos, atendimentoSchema, a);
export { novoId };
