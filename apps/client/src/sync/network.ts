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
  // Chamado a cada mudança: online = true (tem internet) ou false (sem internet).
  onNetworkChange(online: boolean): void;
}

// Nome usado para lembrar a posição da chave Online/Offline no navegador (localStorage).
const CHAVE = 'mf.simuladorOnline';

// Lê a posição salva da chave. Se nunca foi mexida (ou não dá para ler), começa Online.
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
  // A lista de quem quer ser avisado (Set = lista sem repetidos).
  private observers = new Set<NetworkObserver>();
  // Estado 1: a chave Online/Offline da tela.
  private simuladorOnline = lerSimulador();
  // Estado 2: a internet de verdade, segundo o navegador.
  private navegadorOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  constructor() {
    // O navegador avisa quando a internet de verdade cai ou volta.
    if (typeof window !== 'undefined') {
      // Internet voltou: atualiza o estado 2 e avisa todo mundo.
      window.addEventListener('online', () => this.atualizar(() => (this.navegadorOnline = true)));
      // Internet caiu: atualiza o estado 2 e avisa todo mundo.
      window.addEventListener('offline', () => this.atualizar(() => (this.navegadorOnline = false)));
    }
  }

  // INSCRIÇÃO: coloca o observer na lista. Devolve uma função que tira ele da lista depois.
  subscribe(o: NetworkObserver): () => void {
    this.observers.add(o);
    return () => this.unsubscribe(o);
  }

  // Sair da lista: deixa de receber avisos.
  unsubscribe(o: NetworkObserver) {
    this.observers.delete(o);
  }

  // Está online? Só se a chave estiver em Online E o navegador tiver internet.
  isOnline(): boolean {
    return this.simuladorOnline && this.navegadorOnline;
  }

  // Posição da chave Online/Offline (para a tela desenhar o botão).
  get simulador(): boolean {
    return this.simuladorOnline;
  }

  // Se tem internet de verdade (para a tela mostrar "sem rede" mesmo com a chave em Online).
  get redeReal(): boolean {
    return this.navegadorOnline;
  }

  // A chave Online/Offline da tela (para simular a falta de internet na apresentação).
  setSimulador(online: boolean) {
    this.atualizar(() => {
      // Muda o estado 1.
      this.simuladorOnline = online;
      try {
        // Lembra a posição da chave, para continuar igual se a página for recarregada.
        localStorage.setItem(CHAVE, String(online));
      } catch {
        /* armazenamento indisponível: vale só nesta sessão */
      }
    });
  }

  // Toda mudança (internet real ou chave da tela) passa por aqui: muda o estado e chama notify().
  private atualizar(muda: () => void) {
    // Aplica a mudança recebida.
    muda();
    // Avisa todos os observers.
    this.notify();
  }

  // O AVISO: percorre a lista e chama onNetworkChange(online) em cada observer.
  // O monitor não sabe o que cada um faz com o aviso; o SyncEngine, por exemplo, envia a fila.
  notify() {
    // Calcula o estado atual uma vez...
    const online = this.isOnline();
    // ...e entrega para cada um da lista.
    for (const o of this.observers) o.onNetworkChange(online);
  }
}

// Um único monitor para o app inteiro: todos se inscrevem neste mesmo objeto.
export const network = new NetworkMonitor();
