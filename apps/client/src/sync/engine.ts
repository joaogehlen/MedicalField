/**
 * SyncEngine — Observer do NetworkMonitor. Quando a conexão volta, drena a Outbox
 * (push, em ordem FIFO) e depois recebe as mudanças da central (pull por cursor).
 */
import type { LogBatchRequest, PullResponse } from '@medicalfield/shared';
import { api, ApiError, dispositivoId, NetworkUnavailableError, novoId, SessaoExpiradaError } from '../api/client';
import { sessao } from '../auth/session';
import { db, type OperacaoOutbox } from '../data/db';
import { registrarLog } from '../services/logs';
import { comandoPara } from './commands';
import { network, type NetworkObserver } from './network';

export interface EstadoSync {
  sincronizando: boolean;
  fase: 'ENVIANDO' | 'RECEBENDO' | null;
  ultimaSync: string | null;
  ultimoRecebimento: string | null;
  erro: string | null;
  precisaLogin: boolean;
}

type Ouvinte = (e: EstadoSync) => void;

const INTERVALO_RETENTATIVA = 30_000;

export class SyncEngine implements NetworkObserver {
  private estado: EstadoSync = {
    sincronizando: false,
    fase: null,
    ultimaSync: null,
    ultimoRecebimento: null,
    erro: null,
    precisaLogin: false,
  };
  private ouvintes = new Set<Ouvinte>();
  private emAndamento: Promise<void> | null = null;
  private online = network.isOnline();
  private timer: ReturnType<typeof setInterval> | null = null;

  iniciar() {
    network.subscribe(this);
    void Promise.all([db.lerMeta<string | null>('ultimaSync', null), db.lerMeta<string | null>('ultimoRecebimento', null)]).then(
      ([ultimaSync, ultimoRecebimento]) => this.definir({ ultimaSync, ultimoRecebimento }),
    );
    this.timer ??= setInterval(() => {
      if (network.isOnline() && sessao.get()) void this.push();
    }, INTERVALO_RETENTATIVA);
    if (network.isOnline() && sessao.get()) void this.sincronizar();
  }

  get atual() {
    return this.estado;
  }

  subscribe(o: Ouvinte) {
    this.ouvintes.add(o);
    return () => {
      this.ouvintes.delete(o);
    };
  }

  private definir(p: Partial<EstadoSync>) {
    this.estado = { ...this.estado, ...p };
    this.ouvintes.forEach((o) => o(this.estado));
  }

  /** Observer: reage à transição offline → online (e registra a troca no log local). */
  onNetworkChange(online: boolean) {
    if (online === this.online) return;
    this.online = online;
    void registrarLog('REDE_ALTERADA', null, null, { online, simulador: network.simulador });
    if (online && sessao.get()) void this.sincronizar();
  }

  /** Chamado após cada gravação local: online, envia na hora. */
  solicitar() {
    if (network.isOnline() && sessao.get()) void this.push();
  }

  /** Envia pendências e depois recebe mudanças. */
  sincronizar(): Promise<void> {
    return this.exclusivo(async () => {
      await this.executarPush();
      await this.executarPull();
    });
  }

  push(): Promise<void> {
    return this.exclusivo(() => this.executarPush());
  }

  /** "Receber dados da central". */
  pull(): Promise<void> {
    return this.exclusivo(() => this.executarPull());
  }

  private async exclusivo(fn: () => Promise<void>): Promise<void> {
    while (this.emAndamento) await this.emAndamento.catch(() => undefined);
    this.emAndamento = (async () => {
      this.definir({ sincronizando: true, erro: null });
      try {
        await fn();
      } catch (e) {
        this.tratarErroGeral(e);
      } finally {
        this.definir({ sincronizando: false, fase: null });
      }
    })();
    try {
      await this.emAndamento;
    } finally {
      this.emAndamento = null;
    }
  }

  private tratarErroGeral(e: unknown) {
    if (e instanceof SessaoExpiradaError) {
      this.definir({ precisaLogin: true, erro: e.message });
    } else if (e instanceof NetworkUnavailableError) {
      this.definir({ erro: null });
    } else {
      this.definir({ erro: e instanceof Error ? e.message : 'Falha na sincronização.' });
    }
  }

  private async executarPush() {
    if (!network.isOnline()) return;
    this.definir({ fase: 'ENVIANDO' });
    const fila = await db.outbox.where('status').anyOf('PENDENTE', 'ENVIANDO').sortBy('seq');
    let enviados = 0;
    for (const op of fila) {
      const continuar = await this.executarOperacao(op);
      if (continuar === 'PARAR') break;
      if (continuar === 'OK') enviados++;
    }
    await this.enviarLogs();
    if (enviados > 0) {
      const agora = new Date().toISOString();
      await db.gravarMeta('ultimaSync', agora);
      this.definir({ ultimaSync: agora, precisaLogin: false });
      await registrarLog('SINCRONIZACAO_CONCLUIDA', null, null, { enviados });
    }
  }

  private async executarOperacao(op: OperacaoOutbox): Promise<'OK' | 'SEGUIR' | 'PARAR'> {
    await db.outbox.update(op.seq!, { status: 'ENVIANDO', tentativas: op.tentativas + 1 });
    try {
      await comandoPara(op).execute();
      await db.outbox.update(op.seq!, { status: 'CONCLUIDO', ultimoErro: null, concluidoEm: new Date().toISOString() });
      return 'OK';
    } catch (e) {
      const voltar = (erro: string | null) => db.outbox.update(op.seq!, { status: 'PENDENTE', ultimoErro: erro });
      if (e instanceof NetworkUnavailableError) {
        await voltar(null);
        return 'PARAR';
      }
      if (e instanceof SessaoExpiradaError) {
        await voltar(e.message);
        this.definir({ precisaLogin: true });
        return 'PARAR';
      }
      if (e instanceof ApiError && (e.status === 409 && e.codigo === 'DEPENDENCIA_AUSENTE')) {
        await voltar(e.message);
        return 'PARAR';
      }
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        // Erro permanente (validação, regra clínica): não adianta reenviar igual.
        await db.outbox.update(op.seq!, { status: 'ERRO', ultimoErro: e.message });
        await this.marcarErro(op, e.message);
        await registrarLog('ERRO_SINCRONIZACAO', op.tipo, op.entidadeId, { codigo: e.codigo, status: e.status }, 'ERROR');
        return 'SEGUIR';
      }
      await voltar(e instanceof Error ? e.message : 'Falha temporária');
      return 'PARAR';
    }
  }

  private async marcarErro(op: OperacaoOutbox, erro: string) {
    const tabela = op.tipo === 'UPSERT_PESSOA' ? db.pessoas : op.tipo === 'UPSERT_PRONTUARIO' ? db.prontuarios : db.atendimentos;
    await tabela.update(op.entidadeId, { syncStatus: 'ERRO', syncErro: erro });
  }

  /** Envia os logs gerados no aparelho (POST /log), em lotes idempotentes. */
  private async enviarLogs() {
    for (;;) {
      const lote = await db.logsLocais.where('enviado').equals(0).limit(200).toArray();
      if (lote.length === 0) return;
      const corpo: LogBatchRequest = {
        dispositivoId: dispositivoId(),
        logs: lote.map(({ enviado: _e, ...l }) => l),
      };
      await api('POST', '/log', corpo, { idempotencyKey: novoId() });
      await db.logsLocais.bulkUpdate(lote.map((l) => ({ key: l.id, changes: { enviado: 1 as const } })));
      if (lote.length < 200) return;
    }
  }

  private async executarPull() {
    if (!network.isOnline()) throw new NetworkUnavailableError();
    this.definir({ fase: 'RECEBENDO' });
    let cursor = await db.lerMeta<number>('syncCursor', 0);
    for (;;) {
      const r = await api<PullResponse>('GET', `/sync/pull?cursor=${cursor}&limite=500`);
      await this.aplicarPull(r);
      cursor = r.proximoCursor;
      await db.gravarMeta('syncCursor', cursor);
      if (!r.temMais) break;
    }
    const agora = new Date().toISOString();
    await db.gravarMeta('ultimoRecebimento', agora);
    this.definir({ ultimoRecebimento: agora, precisaLogin: false });
  }

  /** Aplica as mudanças da central sem sobrescrever registros com envio pendente. */
  private async aplicarPull(r: PullResponse) {
    const pendentes = new Set(
      (await db.outbox.where('status').anyOf('PENDENTE', 'ENVIANDO', 'ERRO').toArray()).map((o) => o.entidadeId),
    );
    const livres = <T extends { id: string }>(lista: T[]) => lista.filter((x) => !pendentes.has(x.id));
    const sinc = { syncStatus: 'SINCRONIZADO' as const, syncErro: null };
    await db.transaction('rw', [db.medicamentos, db.hospitais, db.viaturas, db.pessoas, db.prontuarios, db.atendimentos], async () => {
      await db.medicamentos.bulkPut(r.medicamentos);
      await db.hospitais.bulkPut(r.hospitais);
      await db.viaturas.bulkPut(r.viaturas);
      await db.pessoas.bulkPut(livres(r.pessoas).map((p) => ({ ...p, ...sinc })));
      await db.prontuarios.bulkPut(livres(r.prontuarios).map((p) => ({ ...p, ...sinc })));
      await db.atendimentos.bulkPut(livres(r.atendimentos).map((a) => ({ ...a, ...sinc })));
    });
  }

  async tentarNovamente(seq: number) {
    await db.outbox.update(seq, { status: 'PENDENTE', ultimoErro: null });
    await this.push();
  }

  /** Descarta uma operação com erro permanente (o registro local continua no aparelho). */
  async descartar(seq: number) {
    await db.outbox.update(seq, { status: 'CONCLUIDO', ultimoErro: 'Descartada pelo profissional', concluidoEm: new Date().toISOString() });
  }
}

export const syncEngine = new SyncEngine();
