/**
 * Padrão Observer — o NetworkMonitor é o Subject: combina o estado real da rede
 * (navigator.onLine) com a chave "Simular conectividade" e avisa os Observers
 * (SyncEngine, casca da aplicação) a cada mudança.
 */
export interface NetworkObserver {
  onNetworkChange(online: boolean): void;
}

const CHAVE = 'mf.simuladorOnline';

function lerSimulador(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== 'false';
  } catch {
    return true;
  }
}

export class NetworkMonitor {
  private observers = new Set<NetworkObserver>();
  private simuladorOnline = lerSimulador();
  private navegadorOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.atualizar(() => (this.navegadorOnline = true)));
      window.addEventListener('offline', () => this.atualizar(() => (this.navegadorOnline = false)));
    }
  }

  subscribe(o: NetworkObserver): () => void {
    this.observers.add(o);
    return () => this.unsubscribe(o);
  }

  unsubscribe(o: NetworkObserver) {
    this.observers.delete(o);
  }

  isOnline(): boolean {
    return this.simuladorOnline && this.navegadorOnline;
  }

  get simulador(): boolean {
    return this.simuladorOnline;
  }

  get redeReal(): boolean {
    return this.navegadorOnline;
  }

  /** Chave "Simular conectividade (Online / Offline)". */
  setSimulador(online: boolean) {
    this.atualizar(() => {
      this.simuladorOnline = online;
      try {
        localStorage.setItem(CHAVE, String(online));
      } catch {
        /* armazenamento indisponível: vale só nesta sessão */
      }
    });
  }

  private atualizar(muda: () => void) {
    muda();
    this.notify();
  }

  /** Avisa todos os observers; cada um decide o que fazer com a transição. */
  notify() {
    const online = this.isOnline();
    for (const o of this.observers) o.onNetworkChange(online);
  }
}

export const network = new NetworkMonitor();
