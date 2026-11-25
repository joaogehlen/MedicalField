/**
 * PADRÃO OBSERVER — "o grupo de avisos da turma"
 *
 * NetworkMonitor é o Subject: guarda a lista de interessados (os Observers).
 * Quando a rede cai ou volta (ou alguém mexe na chave Online/Offline), ele avisa
 * todos chamando onNetworkChange(online). Ninguém precisa ficar perguntando "voltou?".
 * Quem escuta: o SyncEngine (envia a fila sozinho quando a rede volta) e a tela (muda a faixa).
 */
// Para entrar no "grupo", basta ter este método.
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
    // O navegador avisa quando a internet de verdade cai ou volta.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.atualizar(() => (this.navegadorOnline = true)));
      window.addEventListener('offline', () => this.atualizar(() => (this.navegadorOnline = false)));
    }
  }

  // Entrar no grupo (devolve a função para sair).
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

  // A chave Online/Offline da tela (para simular a falta de internet na apresentação).
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

  // Toda mudança passa por aqui: muda o estado e avisa o grupo.
  private atualizar(muda: () => void) {
    muda();
    this.notify();
  }

  // Mandar o aviso para todo mundo do grupo; cada um decide o que fazer.
  notify() {
    const online = this.isOnline();
    for (const o of this.observers) o.onNetworkChange(online);
  }
}

export const network = new NetworkMonitor();
