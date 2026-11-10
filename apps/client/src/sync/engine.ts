/**
 * SyncEngine — Observer do NetworkMonitor. Quando a conexão volta, envia a Outbox
 * (em ordem: pessoa → prontuário → atendimento) e os logs do aparelho, e depois
 * recebe as mudanças da central (pull por cursor).
 */
import type { PullResponse } from '@medicalfield/shared';
import { api, ApiError, dispositivoId, novoId, SemConexaoError } from '../api/client';
import { sessao } from '../auth/session';
import { db } from '../data/db';
import { registrarLog } from '../services/logs';
import { comandoPara } from './commands';
import { network, type NetworkObserver } from './network';

export interface EstadoSync {
  ocupado: boolean;
  ultimoEnvio: string | null;
  ultimoRecebimento: string | null;
  erro: string | null;
}

export class SyncEngine implements NetworkObserver {
  private estado: EstadoSync = { ocupado: false, ultimoEnvio: null, ultimoRecebimento: null, erro: null };
  private ouvintes = new Set<(e: EstadoSync) => void>();
  private online = network.isOnline();
  private fila: Promise<void> = Promise.resolve();

  iniciar() {
    network.subscribe(this);
    void Promise.all([db.lerMeta<string | null>('ultimoEnvio', null), db.lerMeta<string | null>('ultimoRecebimento', null)]).then(
      ([ultimoEnvio, ultimoRecebimento]) => this.definir({ ultimoEnvio, ultimoRecebimento }),
    );
  }

  get atual() {
    return this.estado;
  }

  subscribe(o: (e: EstadoSync) => void) {
    this.ouvintes.add(o);
    return () => void this.ouvintes.delete(o);
  }

  private definir(p: Partial<EstadoSync>) {
    this.estado = { ...this.estado, ...p };
    this.ouvintes.forEach((o) => o(this.estado));
  }

  /** Observer: ao passar de offline para online, sincroniza sozinho. */
  onNetworkChange(online: boolean) {
    if (online === this.online) return;
    this.online = online;
    void registrarLog(online ? 'REDE_ONLINE' : 'REDE_OFFLINE');
    if (online) void this.sincronizar();
  }

  /** Chamado após cada gravação: estando online, envia na hora. */
  solicitar() {
    if (network.isOnline()) void this.enviar();
  }

  sincronizar() {
    return this.exclusivo(async () => {
      await this.executarEnvio();
      await this.executarRecebimento();
    });
  }

  enviar() {
    return this.exclusivo(() => this.executarEnvio());
  }

  receber() {
    return this.exclusivo(() => this.executarRecebimento());
  }

  /** Uma sincronização por vez. */
  private exclusivo(fn: () => Promise<void>) {
    this.fila = this.fila.then(async () => {
      if (!sessao.get()) return;
      this.definir({ ocupado: true, erro: null });
      try {
        await fn();
      } catch (e) {
        if (!(e instanceof SemConexaoError)) this.definir({ erro: e instanceof Error ? e.message : 'Falha na sincronização.' });
      } finally {
        this.definir({ ocupado: false });
      }
    });
    return this.fila;
  }

  private async executarEnvio() {
    if (!network.isOnline()) return;
    for (const op of await db.outbox.where('status').equals('PENDENTE').sortBy('seq')) {
      try {
        await comandoPara(op).execute();
        await db.outbox.update(op.seq!, { status: 'CONCLUIDO', erro: null });
      } catch (e) {
        // Erro de validação ou regra clínica: não adianta reenviar; o resto segue.
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 409) {
          await db.outbox.update(op.seq!, { status: 'ERRO', erro: e.message });
          continue;
        }
        throw e; // sem rede, central fora do ar ou dependência ausente: tenta de novo depois
      }
    }
    const logs = await db.logsLocais.where('enviado').equals(0).toArray();
    if (logs.length) {
      await api('POST', '/log', { dispositivoId: dispositivoId(), logs: logs.map(({ enviado: _e, ...l }) => l) }, novoId());
      await db.logsLocais.bulkUpdate(logs.map((l) => ({ key: l.id, changes: { enviado: 1 as const } })));
    }
    const agora = new Date().toISOString();
    await db.gravarMeta('ultimoEnvio', agora);
    this.definir({ ultimoEnvio: agora });
  }

  private async executarRecebimento() {
    if (!network.isOnline()) throw new SemConexaoError();
    const cursor = await db.lerMeta<number>('cursor', 0);
    const r = await api<PullResponse>('GET', `/sync/pull?cursor=${cursor}`);
    const pendentes = new Set((await db.outbox.where('status').equals('PENDENTE').toArray()).map((o) => o.entidadeId));
    const livres = <T extends { id: string }>(l: T[]) => l.filter((x) => !pendentes.has(x.id)).map((x) => ({ ...x, syncStatus: 'SINCRONIZADO' as const }));
    await db.transaction('rw', [db.medicamentos, db.pessoas, db.prontuarios, db.atendimentos, db.meta], async () => {
      await db.medicamentos.bulkPut(r.medicamentos);
      await db.pessoas.bulkPut(livres(r.pessoas));
      await db.prontuarios.bulkPut(livres(r.prontuarios));
      await db.atendimentos.bulkPut(livres(r.atendimentos));
      await db.gravarMeta('cursor', r.proximoCursor);
    });
    const agora = new Date().toISOString();
    await db.gravarMeta('ultimoRecebimento', agora);
    this.definir({ ultimoRecebimento: agora });
  }
}

export const syncEngine = new SyncEngine();
