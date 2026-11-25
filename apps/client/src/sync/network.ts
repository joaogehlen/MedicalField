/**
 * PADRÃO OBSERVER — "o grupo de avisos da turma"
 *
 * NetworkMonitor é o Subject: guarda a lista de interessados (os Observers).
 * Quando a rede cai ou volta (ou alguém mexe na chave Online/Offline), ele avisa
 * todos chamando onNetworkChange(online). Ninguém precisa ficar perguntando "voltou?".
 * Quem escuta: o SyncEngine (envia a fila sozinho quando a rede volta) e a tela (muda a faixa).
 */
// O OBSERVER
// Quem quiser ser avisado da rede implementa este único método. O SyncEngine (engine.ts) e a
// barra da tela fazem isso.
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

// O SUBJECT
// Guarda a lista de observers e dois estados: a internet real do navegador e a chave
// Online/Offline da tela. Só está "online" quando os dois estão ligados.
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

  // INSCRIÇÃO: coloca o observer na lista. Devolve uma função que tira ele da lista depois.
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

  // Toda mudança (internet real ou chave da tela) passa por aqui: muda o estado e chama notify().
  private atualizar(muda: () => void) {
    muda();
    this.notify();
  }

  // O AVISO: percorre a lista e chama onNetworkChange(online) em cada observer.
  // O monitor não sabe o que cada um faz com o aviso; o SyncEngine, por exemplo, envia a fila.
  notify() {
    const online = this.isOnline();
    for (const o of this.observers) o.onNetworkChange(online);
  }
}

export const network = new NetworkMonitor();
