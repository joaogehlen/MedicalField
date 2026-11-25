# 09 — Padrões de projeto no código

Guia para mostrar e explicar cada padrão na apresentação. Os trechos abaixo são **copiados dos arquivos do projeto**, com o número das linhas.

**Como abrir no VS Code:** `Ctrl+P` e digite o nome do arquivo; `Ctrl+G` e digite a linha. Para achar todos os padrões de uma vez: `Ctrl+Shift+F` e pesquise `Padrão` — cada arquivo começa com um comentário dizendo qual padrão ele implementa.

| # | Padrão | Tipo | Arquivo principal | Para quê |
|---|---|---|---|---|
| 1 | Repository | Exigido pela proposta | `apps/client/src/data/repositories.ts` | Esconde de onde vêm os dados atrás de uma interface simples: quem usa só pede “busca” ou “lista”. |
| 2 | Strategy | Exigido pela proposta | `services/clinical-service/src/sync/strategies.ts` | Define uma família de algoritmos com a mesma “cara” (mesmo método) e deixa escolher qual usar em cada caso. |
| 3 | Observer | Exigido pela proposta | `apps/client/src/sync/network.ts` | Um objeto (o Subject) avisa automaticamente todos os interessados (os Observers) quando algo muda. |
| 4 | Command | Padrão extra | `apps/client/src/sync/commands.ts` | Transforma uma ação em um objeto, que pode ser guardado numa fila e executado depois, quantas vezes for preciso. |
| 5 | Chain of Responsibility | Padrão extra | `packages/shared/src/clinical/safety.ts` | Passa um pedido por uma corrente de verificadores; cada um confere a sua parte e pode barrar. |
| 6 | Builder | Padrão extra | `services/document-service/app/ficha/builder.py` | Monta um objeto complexo passo a passo, separando a montagem das partes do resultado final. |
| 7 | Adapter | Padrão extra | `services/document-service/app/email/adapters.py` | Deixa classes diferentes serem usadas pela mesma interface, “traduzindo” cada uma para o formato esperado. |

## 1. Repository — exigido pela proposta

**Em uma frase:** Esconde de onde vêm os dados atrás de uma interface simples: quem usa só pede “busca” ou “lista”.

**Comparação:** É o balcão do almoxarifado: você pede o item e não precisa saber em qual prateleira ele está.

**Problema que resolve no MedicalField:** O cliente tem dois lugares de dados: o banco do próprio aparelho (IndexedDB, que funciona sem internet) e a API da central. Se cada tela falasse direto com o IndexedDB ou com a API, o código ficaria espalhado e trocar o armazenamento exigiria mexer em todas as telas.

**A interface e a implementação local (Dexie/IndexedDB)** — `apps/client/src/data/repositories.ts` (linhas 18–44)

```ts
 18  // O CONTRATO
 19  // Todo repositório sabe fazer duas coisas: buscar um registro pelo id e listar todos.
 20  // A tela só conhece estes dois métodos; não sabe se por trás tem IndexedDB, API ou outra coisa.
 21  // <T> = "de qualquer tipo": serve para Pessoa, Prontuário, Atendimento...
 22  export interface Repository<T> {
 23    // buscar: recebe o id e devolve o registro (ou undefined, se não existir).
 24    buscar(id: string): Promise<T | undefined>;
 25    // listar: devolve todos os registros.
 26    listar(): Promise<T[]>;
 27  }
 28  
 29  // O REPOSITÓRIO LOCAL
 30  // Recebe uma tabela do IndexedDB (o banco do navegador) e implementa o contrato em cima dela:
 31  // buscar = tabela.get(id), listar = tabela.toArray(). Funciona sem internet, porque é tudo no aparelho.
 32  // "implements Repository<T>" = promete cumprir o contrato acima.
 33  class LocalRepository<T> implements Repository<T> {
 34    // Guarda a tabela que este repositório vai usar (ex.: db.pessoas).
 35    constructor(protected readonly tabela: Table<T, string>) {}
 36    // Busca um registro pelo id dentro da tabela do aparelho.
 37    async buscar(id: string) {
 38      return this.tabela.get(id);
 39    }
 40    // Devolve todos os registros da tabela do aparelho.
 41    async listar() {
 42      return this.tabela.toArray();
 43    }
 44  }
```

**Os repositórios prontos: local.* (aparelho) e remoto.* (API)** — `apps/client/src/data/repositories.ts` (linhas 75–109)

```ts
 75  // O QUE AS TELAS USAM
 76  // Um repositório pronto para cada tabela. A tela chama, por exemplo, local.pessoas.listar()
 77  // e recebe a lista, sem nenhuma linha de código de banco de dados.
 78  export const local = {
 79    // Pacientes (vítimas), em ordem alfabética.
 80    pessoas: new PessoasLocais(db.pessoas),
 81    // Prontuários (tipo sanguíneo, alergias, comorbidades).
 82    prontuarios: new ProntuariosLocais(db.prontuarios),
 83    // Atendimentos, do mais novo para o mais antigo.
 84    atendimentos: new AtendimentosLocais(db.atendimentos),
 85    // Catálogo de medicamentos: não precisa de nada especial, usa o repositório local puro.
 86    medicamentos: new LocalRepository(db.medicamentos),
 87  };
 88  
 89  // O REPOSITÓRIO REMOTO (a central)
 90  // Salvar = um POST na API. O opId vai como Idempotency-Key: se a internet cair no meio e o
 91  // mesmo envio for repetido, a central reconhece a chave e não grava duas vezes.
 92  class RemoteRepository<T> {
 93    // Guarda a rota da API deste repositório (ex.: '/pessoa').
 94    constructor(private readonly rota: string) {}
 95    // Envia o registro para a central: POST na rota, com o opId como Idempotency-Key.
 96    salvar(registro: unknown, opId: string) {
 97      return api<UpsertResponse<T>>('POST', this.rota, registro, opId);
 98    }
 99  }
100  
101  // Quem usa o remoto é só o envio para a central (commands.ts). As telas nunca chamam a API direto.
102  export const remoto = {
103    // POST /api/pessoa
104    pessoas: new RemoteRepository<PessoaLocal>('/pessoa'),
105    // POST /api/prontuario
106    prontuarios: new RemoteRepository<ProntuarioLocal>('/prontuario'),
107    // POST /api/atendimento
108    atendimentos: new RemoteRepository<AtendimentoLocal>('/atendimento'),
109  };
```

**Como funciona, passo a passo:**

1. A interface Repository<T> define o contrato: buscar(id) e listar().
2. LocalRepository implementa esse contrato usando uma tabela do Dexie (IndexedDB, o banco do navegador).
3. Subclasses especializam o que precisam: PessoasLocais ordena por nome; AtendimentosLocais ordena por data e ganha daPessoa().
4. RemoteRepository faz o POST na API da central, mandando o opId como Idempotency-Key.
5. As telas usam só local.* e o envio para a central usa remoto.*. Nenhuma tela sabe se existe IndexedDB ou HTTP por trás.

**Onde é usado:**

- `apps/client/src/ui/pages/PessoaForm.tsx:14` — a tela de vítima busca a pessoa com local.pessoas.buscar(id)
- `apps/client/src/ui/pages/Paciente.tsx:12` — a ficha do paciente junta pessoa, prontuário e atendimentos pelos repositórios locais
- `apps/client/src/sync/commands.ts:64` — o envio para a central usa remoto.pessoas

**Como mostrar ao vivo:** Com a chave em Offline, abra Pacientes: a lista aparece mesmo sem internet, porque vem de local.pessoas.listar(). Para mostrar o banco por baixo: F12 → Application → IndexedDB → medicalfield-v2.

**Se perguntarem — “Por que não chamar a API direto na tela?”** Porque o sistema precisa funcionar offline: a tela sempre lê do aparelho. E se um dia trocarmos o Dexie por outro banco, só o repositório muda; as telas continuam iguais.

## 2. Strategy — exigido pela proposta

**Em uma frase:** Define uma família de algoritmos com a mesma “cara” (mesmo método) e deixa escolher qual usar em cada caso.

**Comparação:** É como regras de desempate: cada campeonato usa a sua, mas todas respondem à mesma pergunta “quem venceu?”.

**Problema que resolve no MedicalField:** Dois socorristas, cada um sem internet, editam o mesmo registro. Quando os dois sincronizam, a central recebe duas versões. Quem vence? A resposta depende do tipo de dado: para uma pessoa, vale a edição mais recente; para alergias, perder uma é perigoso; um atendimento registrado não deve mudar.

**A interface e as três estratégias** — `services/clinical-service/src/sync/strategies.ts` (linhas 23–86)

```ts
 23  // O CONTRATO
 24  // Toda estratégia recebe as duas versões do registro (a que está no banco e a que acabou de chegar)
 25  // e devolve a versão final. O "nome" vai para o histórico de conflitos (tabela sync_conflito).
 26  export interface ConflictResolutionStrategy<T> {
 27    // O nome da estratégia (LWW, MESCLA ou SERVIDOR_VENCE).
 28    readonly nome: NomeEstrategia;
 29    // servidor = o que está no banco; recebido = o que o aparelho mandou; devolve quem fica.
 30    resolve(servidor: T, recebido: T): T;
 31  }
 32  
 33  // Função de apoio: true se a versão recebida foi editada depois (ou no mesmo horário) da do servidor.
 34  const recebidoMaisRecente = (s: ComRelogio, r: ComRelogio) =>
 35    Date.parse(r.atualizadoEmCliente) >= Date.parse(s.atualizadoEmCliente);
 36  
 37  // ESTRATÉGIA 1 — LAST WRITE WINS (usada em Pessoa)
 38  // Compara o horário em que cada aparelho fez a edição (atualizadoEmCliente).
 39  // Fica a versão editada por último; a outra é descartada.
 40  export class LastWriteWinsStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
 41    // Nome gravado no histórico de conflitos.
 42    readonly nome = 'LWW' as const;
 43    resolve(servidor: T, recebido: T): T {
 44      // A recebida é mais nova? Fica ela. Senão, fica a do servidor.
 45      return recebidoMaisRecente(servidor, recebido) ? recebido : servidor;
 46    }
 47  }
 48  
 49  // ESTRATÉGIA 2 — MESCLA (usada em Prontuário)
 50  // Campos simples (tipo sanguíneo, observações): vence o mais recente, igual à estratégia 1.
 51  // Listas (alergias, comorbidades): junta as duas versões. Se uma equipe anotou "Penicilina" e
 52  // outra anotou "Látex", ficam as duas: perder uma alergia seria perigoso para o paciente.
 53  export class MergeStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
 54    // Nome gravado no histórico de conflitos.
 55    readonly nome = 'MESCLA' as const;
 56    // Usa a estratégia 1 por dentro, para decidir os campos simples.
 57    private readonly lww = new LastWriteWinsStrategy<T>();
 58  
 59    // Recebe quais campos são listas. No prontuário: ['alergias', 'comorbidades'].
 60    constructor(private readonly listas: readonly (keyof T)[]) {}
 61  
 62    resolve(servidor: T, recebido: T): T {
 63      // Passo 1: começa pela versão mais recente (decide os campos simples).
 64      const out = { ...this.lww.resolve(servidor, recebido) };
 65      // Passo 2: para cada campo que é lista...
 66      for (const campo of this.listas) {
 67        // ...troca pela união das duas versões (servidor + recebido), sem repetir.
 68        out[campo] = uniaoTermos(servidor[campo] as string[], recebido[campo] as string[]) as T[keyof T];
 69      }
 70      // Devolve o registro mesclado.
 71      return out;
 72    }
 73  }
 74  
 75  // ESTRATÉGIA 3 — SERVIDOR VENCE (usada em Atendimento)
 76  // Um atendimento já registrado na central é um documento: não pode ser trocado depois.
 77  // Então o que chegou é ignorado e fica a versão que já estava no banco.
 78  export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
 79    // Nome gravado no histórico de conflitos.
 80    readonly nome = 'SERVIDOR_VENCE' as const;
 81    // Só precisa da versão do servidor: o que chegou nem é olhado.
 82    resolve(servidor: T): T {
 83      // Devolve o que já está na central.
 84      return servidor;
 85    }
 86  }
```

**Quando existe conflito** — `services/clinical-service/src/sync/sync-support.ts` (linhas 24–24)

```ts
 24  export const houveConflito = (versaoServidor: number, baseVersion?: number | null) => (baseVersion ?? 0) < versaoServidor;
```

**O serviço de prontuário usando a estratégia** — `services/clinical-service/src/prontuario/prontuario.service.ts` (linhas 71–82)

```ts
 71      const servidor = prontuarioDeLinha(linha);
 72      const conflito = houveConflito(servidor.version!, recebido.baseVersion); // alguém mudou no meio do caminho?
 73      // Strategy: no conflito, pergunta à estratégia quem vence, sem saber qual algoritmo ela usa.
 74      const final = conflito ? this.estrategia.resolve(servidor, recebido) : recebido;
 75      const r = await tx.one(
 76        `UPDATE prontuario SET tipo_sanguineo=$2, alergias=$3, comorbidades=$4, observacoes=$5, atualizado_em_cliente=$6,
 77           sincronizado_em=now() WHERE id=$1 RETURNING *`,
 78        [final.id, final.tipoSanguineo, final.alergias, final.comorbidades, final.observacoes, final.atualizadoEmCliente],
 79      );
 80      const salvo = prontuarioDeLinha(r);
 81      if (conflito) await this.sync.registrarConflito(tx, 'PRONTUARIO', salvo.id, this.estrategia.nome, servidor, recebido, salvo);
 82      return { status: HttpStatus.OK, corpo: { resultado: conflito ? 'MESCLADO' : 'ATUALIZADO', registro: salvo } };
```

**Como funciona, passo a passo:**

1. Toda edição chega com baseVersion, a versão que o aparelho conhecia. Se ela for menor que a versão atual no banco, alguém mudou o registro no meio do caminho: é um conflito (houveConflito).
2. Cada serviço guarda a sua estratégia: PessoaService usa LastWriteWinsStrategy; ProntuarioService usa MergeStrategy(['alergias', 'comorbidades']); AtendimentoService usa ServerWinsStrategy.
3. No conflito, o serviço só chama this.estrategia.resolve(servidor, recebido). Ele não sabe qual algoritmo está rodando.
4. LastWriteWins compara atualizadoEmCliente e fica com o mais recente. Merge faz o mesmo nos campos simples e une as listas (alergias nunca somem). ServerWins devolve o que já está no banco.
5. O resultado é gravado, a resposta diz MESCLADO, e o caso fica registrado na tabela clinical.sync_conflito (valor do servidor, valor recebido e resultado).

**Onde é usado:**

- `services/clinical-service/src/pessoa/pessoa.service.ts:11` — PessoaService escolhe LastWriteWinsStrategy
- `services/clinical-service/src/prontuario/prontuario.service.ts:23` — ProntuarioService escolhe MergeStrategy para alergias e comorbidades
- `services/clinical-service/src/atendimento/atendimento.service.ts:41` — AtendimentoService escolhe ServerWinsStrategy

**Como mostrar ao vivo:** No Insomnia, pasta clinical-service → “Cadastrar prontuário”: troque as alergias para ["Látex"] e envie. O prontuário já existe e tinha Penicilina; a resposta vem MESCLADO com as duas alergias. No DBeaver, a tabela clinical.sync_conflito mostra o registro do conflito.

**Se perguntarem — “O que ganha usando Strategy em vez de um if?”** Cada regra fica numa classe pequena e testável (há testes em strategies.test.ts). Para mudar a regra de um tipo de dado, troca-se a estratégia em uma linha, sem mexer no fluxo de gravação.

## 3. Observer — exigido pela proposta

**Em uma frase:** Um objeto (o Subject) avisa automaticamente todos os interessados (os Observers) quando algo muda.

**Comparação:** É o grupo de avisos da turma: quem entrou no grupo recebe a mensagem sem precisar perguntar toda hora.

**Problema que resolve no MedicalField:** Quando a internet volta, os registros guardados no aparelho precisam ir para a central sozinhos, sem o socorrista clicar em nada. E a tela também precisa mudar de cor na hora. Ficar perguntando “a rede voltou?” a cada segundo seria desperdício.

**O contrato do Observer** — `apps/client/src/sync/network.ts` (linhas 9–15)

```ts
  9  // O OBSERVER
 10  // Quem quiser ser avisado da rede implementa este único método. O SyncEngine (engine.ts) e a
 11  // barra da tela fazem isso.
 12  export interface NetworkObserver {
 13    // Chamado a cada mudança: online = true (tem internet) ou false (sem internet).
 14    onNetworkChange(online: boolean): void;
 15  }
```

**O Subject: NetworkMonitor guarda a lista de observers** — `apps/client/src/sync/network.ts` (linhas 29–54)

```ts
 29  // O SUBJECT
 30  // Guarda a lista de observers e dois estados: a internet real do navegador e a chave
 31  // Online/Offline da tela. Só está "online" quando os dois estão ligados.
 32  export class NetworkMonitor {
 33    // A lista de quem quer ser avisado (Set = lista sem repetidos).
 34    private observers = new Set<NetworkObserver>();
 35    // Estado 1: a chave Online/Offline da tela.
 36    private simuladorOnline = lerSimulador();
 37    // Estado 2: a internet de verdade, segundo o navegador.
 38    private navegadorOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
 39  
 40    constructor() {
 41      // O navegador avisa quando a internet de verdade cai ou volta.
 42      if (typeof window !== 'undefined') {
 43        // Internet voltou: atualiza o estado 2 e avisa todo mundo.
 44        window.addEventListener('online', () => this.atualizar(() => (this.navegadorOnline = true)));
 45        // Internet caiu: atualiza o estado 2 e avisa todo mundo.
 46        window.addEventListener('offline', () => this.atualizar(() => (this.navegadorOnline = false)));
 47      }
 48    }
 49  
 50    // INSCRIÇÃO: coloca o observer na lista. Devolve uma função que tira ele da lista depois.
 51    subscribe(o: NetworkObserver): () => void {
 52      this.observers.add(o);
 53      return () => this.unsubscribe(o);
 54    }
```

**A chave Online/Offline muda o estado e chama notify()** — `apps/client/src/sync/network.ts` (linhas 76–105)

```ts
 76    // A chave Online/Offline da tela (para simular a falta de internet na apresentação).
 77    setSimulador(online: boolean) {
 78      this.atualizar(() => {
 79        // Muda o estado 1.
 80        this.simuladorOnline = online;
 81        try {
 82          // Lembra a posição da chave, para continuar igual se a página for recarregada.
 83          localStorage.setItem(CHAVE, String(online));
 84        } catch {
 85          /* armazenamento indisponível: vale só nesta sessão */
 86        }
 87      });
 88    }
 89  
 90    // Toda mudança (internet real ou chave da tela) passa por aqui: muda o estado e chama notify().
 91    private atualizar(muda: () => void) {
 92      // Aplica a mudança recebida.
 93      muda();
 94      // Avisa todos os observers.
 95      this.notify();
 96    }
 97  
 98    // O AVISO: percorre a lista e chama onNetworkChange(online) em cada observer.
 99    // O monitor não sabe o que cada um faz com o aviso; o SyncEngine, por exemplo, envia a fila.
100    notify() {
101      // Calcula o estado atual uma vez...
102      const online = this.isOnline();
103      // ...e entrega para cada um da lista.
104      for (const o of this.observers) o.onNetworkChange(online);
105    }
```

**O SyncEngine implementa NetworkObserver e se inscreve** — `apps/client/src/sync/engine.ts` (linhas 21–28)

```ts
 21  export class SyncEngine implements NetworkObserver {
 22    private estado: EstadoSync = { ocupado: false, ultimoEnvio: null, ultimoRecebimento: null, erro: null };
 23    private ouvintes = new Set<(e: EstadoSync) => void>();
 24    private online = network.isOnline();
 25    private fila: Promise<void> = Promise.resolve();
 26  
 27    iniciar() {
 28      network.subscribe(this); // Observer: entra no "grupo de avisos" da rede
```

**O que o Observer faz quando é avisado** — `apps/client/src/sync/engine.ts` (linhas 48–54)

```ts
 48    // Observer: o NetworkMonitor chama isto. Voltou a internet? Sincroniza sozinho.
 49    onNetworkChange(online: boolean) {
 50      if (online === this.online) return;
 51      this.online = online;
 52      void registrarLog(online ? 'REDE_ONLINE' : 'REDE_OFFLINE');
 53      if (online) void this.sincronizar(); // voltou a internet: envia a fila sozinho, sem clique
 54    }
```

**Como funciona, passo a passo:**

1. NetworkObserver é o contrato: quem quiser ser avisado implementa onNetworkChange(online).
2. O NetworkMonitor (Subject) guarda os observers num Set. subscribe() adiciona; unsubscribe() remove.
3. Ele junta duas fontes: os eventos online/offline do navegador e a chave “Simular conectividade”. Qualquer mudança chama atualizar() → notify().
4. notify() percorre todos os observers e chama onNetworkChange(isOnline()).
5. O SyncEngine se inscreve ao iniciar (network.subscribe(this)). Quando recebe online = true depois de estar offline, chama sincronizar(): envia a fila e recebe as novidades.
6. A tela também é observer (useRede em hooks.ts): troca a chave para amarelo e mostra a faixa “Você está offline”.

**Onde é usado:**

- `apps/client/src/ui/Layout.tsx:19` — a chave da tela chama network.setSimulador(...)
- `apps/client/src/ui/hooks.ts:13` — a tela se inscreve como observer para redesenhar a barra
- `apps/client/src/main.tsx:8` — syncEngine.iniciar() faz a inscrição quando o app abre

**Como mostrar ao vivo:** No cliente, desligue a chave (Offline): a faixa amarela e preta aparece na hora. Crie uma vítima: fica “1 pendente”. Ligue a chave: sem clicar em mais nada, o contador vai para “Tudo na central”.

**Se perguntarem — “Quem é o Subject e quem é o Observer?”** O Subject é o NetworkMonitor (network.ts). Os Observers são o SyncEngine (engine.ts), que sincroniza, e a barra da tela (hooks.ts), que muda de cor. O Subject não conhece nenhum deles; só chama onNetworkChange.

## 4. Command — padrão extra

**Em uma frase:** Transforma uma ação em um objeto, que pode ser guardado numa fila e executado depois, quantas vezes for preciso.

**Comparação:** É a comanda do restaurante: o pedido fica anotado no papel e a cozinha executa quando der, na ordem.

**Problema que resolve no MedicalField:** Sem internet, o envio para a central não pode acontecer agora, mas também não pode ser esquecido. Ele precisa esperar numa fila, na ordem certa (pessoa antes do prontuário, prontuário antes do atendimento), e poder ser repetido sem duplicar se a rede cair no meio.

**Ao salvar: grava o registro e cria a operação na fila (Outbox), na mesma transação** — `apps/client/src/services/registro.ts` (linhas 33–39)

```ts
 33    await db.transaction('rw', tabela, db.outbox, async () => {
 34      await tabela.put({ ...registro, syncStatus: 'PENDENTE' } as T & Local); // grava no aparelho
 35      // Command: guarda o "pedido" na fila (Outbox) para ser executado quando houver internet.
 36      await db.outbox.add({ opId: novoId(), tipo, entidadeId: registro.id, status: 'PENDENTE', criadoEm: new Date().toISOString() });
 37    });
 38    await registrarLog(`${tipo}_${existente ? 'ALTERADO' : 'CRIADO'}`, { id: registro.id });
 39    syncEngine.solicitar();
```

**O comando e a fábrica que escolhe o comando certo para cada operação** — `apps/client/src/sync/commands.ts` (linhas 16–72)

```ts
 16  // O CONTRATO
 17  // Um comando é qualquer objeto que sabe se executar. Quem executa (o SyncEngine) não precisa
 18  // saber se é uma pessoa, um prontuário ou um atendimento.
 19  export interface OutboxCommand {
 20    // Executa o pedido (enviar para a central). É assíncrono porque depende da rede.
 21    execute(): Promise<void>;
 22  }
 23  
 24  // O COMANDO
 25  // Guarda o pedido da fila (op), a tabela do aparelho e o destino na central.
 26  // Ele envia o estado ATUAL do registro: se a pessoa foi editada 3 vezes offline, vai a última versão.
 27  // "Upsert" = cria se não existe, atualiza se já existe.
 28  class UpsertCommand<L extends { id: string; version?: number; syncStatus: string }> implements OutboxCommand {
 29    constructor(
 30      // O item da fila: diz qual registro enviar (entidadeId) e a chave do envio (opId).
 31      private readonly op: OperacaoOutbox,
 32      // A tabela do aparelho onde o registro está guardado (ex.: db.pessoas).
 33      private readonly tabela: Table<L, string>,
 34      // Para onde enviar: o repositório remoto (ex.: remoto.pessoas → POST /pessoa).
 35      private readonly destino: { salvar(registro: unknown, opId: string): Promise<{ registro: unknown }> },
 36    ) {}
 37  
 38    // EXECUTAR: 1) pega o registro no aparelho  2) envia à central com a baseVersion (para detectar
 39    // conflito)  3) grava a resposta da central no aparelho, marcada como SINCRONIZADO.
 40    async execute() {
 41      // 1) Lê o registro atual no aparelho.
 42      const registro = await this.tabela.get(this.op.entidadeId);
 43      // Se o registro não existe mais, não há o que enviar.
 44      if (!registro) return;
 45      // Separa os campos que são só do aparelho (syncStatus, version) dos dados que vão para a central.
 46      const { syncStatus: _s, version, ...dados } = registro as L & { syncErro?: unknown };
 47      // Tira também a mensagem de erro de envio, que só existe no aparelho.
 48      delete (dados as { syncErro?: unknown }).syncErro;
 49      // 2) Envia. baseVersion = a versão que o aparelho conhecia (a central usa para ver se houve conflito).
 50      const r = await this.destino.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
 51      // 3) Guarda no aparelho o que a central devolveu (versão nova, ou mesclada), como SINCRONIZADO.
 52      await this.tabela.put({ ...(r.registro as L), syncStatus: 'SINCRONIZADO' });
 53    }
 54  }
 55  
 56  // A FÁBRICA
 57  // Lê o tipo do item da fila e monta o comando certo, já ligado à tabela e à rota da API certas.
 58  // O SyncEngine só faz: comandoPara(item).execute().
 59  export function comandoPara(op: OperacaoOutbox): OutboxCommand {
 60    // Olha o tipo do pedido...
 61    switch (op.tipo) {
 62      // Pessoa: lê de db.pessoas e envia para POST /pessoa.
 63      case 'PESSOA':
 64        return new UpsertCommand(op, db.pessoas, remoto.pessoas);
 65      // Prontuário: lê de db.prontuarios e envia para POST /prontuario.
 66      case 'PRONTUARIO':
 67        return new UpsertCommand(op, db.prontuarios, remoto.prontuarios);
 68      // Atendimento: lê de db.atendimentos e envia para POST /atendimento.
 69      case 'ATENDIMENTO':
 70        return new UpsertCommand(op, db.atendimentos, remoto.atendimentos);
 71    }
 72  }
```

**O SyncEngine esvazia a fila executando os comandos** — `apps/client/src/sync/engine.ts` (linhas 92–105)

```ts
 92    private async executarEnvio() {
 93      if (!network.isOnline()) return;
 94      for (const op of await db.outbox.where('status').equals('PENDENTE').sortBy('seq')) {
 95        try {
 96          await comandoPara(op).execute(); // Command: executa o pedido guardado na fila
 97          await db.outbox.update(op.seq!, { status: 'CONCLUIDO', erro: null });
 98        } catch (e) {
 99          // Erro de validação ou regra clínica: não adianta reenviar; o resto segue.
100          if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 409) {
101            await db.outbox.update(op.seq!, { status: 'ERRO', erro: e.message });
102            continue;
103          }
104          throw e; // sem rede, central fora do ar ou dependência ausente: tenta de novo depois
105        }
```

**Como funciona, passo a passo:**

1. Toda gravação no aparelho faz duas coisas na mesma transação: salva o registro e adiciona uma operação na Outbox, com um opId único (UUID).
2. comandoPara(op) transforma cada operação da fila num UpsertCommand, ligado à tabela local e ao repositório remoto certos.
3. execute() lê o estado mais recente do registro e manda para a central, com o opId como Idempotency-Key.
4. O SyncEngine percorre a fila em ordem (seq). Deu certo: marca CONCLUIDO. Sem rede: para e tenta depois, mantendo a ordem. Recusado pela central (422): marca ERRO e segue.
5. Como o opId vai junto, se a rede cair depois que a central gravou, o reenvio recebe a mesma resposta e não duplica.

**Onde é usado:**

- `apps/client/src/services/registro.ts:36` — db.outbox.add(...): cria o comando pendente
- `apps/client/src/sync/engine.ts:96` — comandoPara(op).execute(): executa o comando

**Como mostrar ao vivo:** No cliente, Offline: cadastre vítima, prontuário e atendimento. Abra Sincronizar: a tabela “Aguardando envio” mostra os 3 comandos na fila. Ligue a chave: os 3 são executados em ordem e a tabela fica vazia.

**Se perguntarem — “Por que não mandar direto para a API?”** Porque sem internet não dá. O comando guarda a intenção (“enviar esta pessoa”) para executar depois, em ordem e sem duplicar.

## 5. Chain of Responsibility — padrão extra

**Em uma frase:** Passa um pedido por uma corrente de verificadores; cada um confere a sua parte e pode barrar.

**Comparação:** É a fila de fiscais no aeroporto: documento, raio-x, alfândega. Qualquer um pode barrar.

**Problema que resolve no MedicalField:** Antes de dar um remédio, várias regras precisam ser conferidas (via permitida, dose máxima, alergia), e isso tem que funcionar sem internet. Colocar tudo num if gigante dificultaria incluir regras novas.

**O elo da corrente: avalia a sua regra e repassa para o próximo** — `packages/shared/src/clinical/safety.ts` (linhas 22–42)

```ts
 22  // O ELO DA CORRENTE
 23  // Todo fiscal tem um "próximo". avaliar() confere a regra deste fiscal (verificar), guarda o alerta
 24  // se houver problema e passa o pedido adiante. O último fiscal devolve a lista de alertas.
 25  export abstract class RegraSeguranca {
 26    private proxima: RegraSeguranca | null = null;
 27  
 28    // Liga este fiscal ao próximo da fila.
 29    encadear(proxima: RegraSeguranca): RegraSeguranca {
 30      this.proxima = proxima;
 31      return proxima;
 32    }
 33  
 34    // Confere a minha parte e passo para o próximo fiscal.
 35    avaliar(ctx: ContextoAdministracao, alertas: string[] = []): string[] {
 36      const alerta = this.verificar(ctx);
 37      if (alerta) alertas.push(alerta);
 38      return this.proxima ? this.proxima.avaliar(ctx, alertas) : alertas;
 39    }
 40  
 41    protected abstract verificar(ctx: ContextoAdministracao): string | null;
 42  }
```

**As três regras (os elos)** — `packages/shared/src/clinical/safety.ts` (linhas 44–72)

```ts
 44  // Fiscal 1: essa via (IV, IM, VO...) é permitida para o remédio?
 45  export class ViaRule extends RegraSeguranca {
 46    protected verificar({ medicamento, via }: ContextoAdministracao) {
 47      return medicamento.viasPermitidas.includes(via)
 48        ? null
 49        : `Via ${via} não permitida para ${medicamento.nome} (use ${medicamento.viasPermitidas.join(', ')}).`;
 50    }
 51  }
 52  
 53  // Fiscal 2: a dose passa da máxima?
 54  export class DoseMaximaRule extends RegraSeguranca {
 55    protected verificar({ medicamento, dose }: ContextoAdministracao) {
 56      return dose <= medicamento.doseMaxima
 57        ? null
 58        : `Dose de ${dose} ${medicamento.unidade} acima da máxima de ${medicamento.nome} (${medicamento.doseMaxima} ${medicamento.unidade}).`;
 59    }
 60  }
 61  
 62  // Fiscal 3: o paciente é alérgico a esse remédio (ou a um componente dele)?
 63  export class AlergiaRule extends RegraSeguranca {
 64    protected verificar({ medicamento, alergias }: ContextoAdministracao) {
 65      const termos = [medicamento.nome, ...medicamento.alergenos].map(normalizarTexto);
 66      const alergia = alergias.find((a) => {
 67        const n = normalizarTexto(a);
 68        return n.length > 2 && termos.some((t) => t.includes(n) || n.includes(t));
 69      });
 70      return alergia ? `Paciente alérgico a ${alergia}: ${medicamento.nome} não pode ser administrado.` : null;
 71    }
 72  }
```

**A corrente montada: via → dose máxima → alergia** — `packages/shared/src/clinical/safety.ts` (linhas 74–82)

```ts
 74  // MONTAR E USAR A CORRENTE
 75  // Liga os fiscais na ordem via → dose máxima → alergia e passa o pedido pelo primeiro.
 76  // Lista vazia = pode administrar. Esta mesma função é chamada no celular (AtendimentoForm.tsx)
 77  // e no servidor (atendimento.service.ts).
 78  export function avaliarAdministracao(ctx: ContextoAdministracao): string[] {
 79    const cadeia = new ViaRule();
 80    cadeia.encadear(new DoseMaximaRule()).encadear(new AlergiaRule());
 81    return cadeia.avaliar(ctx);
 82  }
```

**Como funciona, passo a passo:**

1. RegraSeguranca é o elo abstrato. Cada elo guarda uma referência para o próximo (encadear).
2. avaliar(ctx) roda verificar() da regra atual; se houver problema, anota o alerta; depois repassa o mesmo pedido para o próximo elo.
3. ViaRule confere se a via (IV, IM, VO…) é permitida; DoseMaximaRule confere a dose; AlergiaRule compara as alergias do prontuário com o nome e os alérgenos do remédio.
4. avaliarAdministracao monta a corrente e devolve a lista de alertas. Lista vazia = pode administrar.
5. Ela fica em packages/shared, então o mesmo código roda no aparelho (offline, na tela) e no servidor (que recusa com 422 REGRA_CLINICA).

**Onde é usado:**

- `apps/client/src/ui/pages/AtendimentoForm.tsx:51` — no aparelho: ao clicar em Adicionar, bloqueia na hora (mesmo offline)
- `services/clinical-service/src/atendimento/atendimento.service.ts:128` — no servidor: confere de novo e responde 422 REGRA_CLINICA

**Como mostrar ao vivo:** No cliente, paciente João Pedro (alérgico a Dipirona) → Novo atendimento → Dipirona 1000 mg IV → Adicionar: aparece “Administração bloqueada”. Pelo Insomnia, “7. Atendimento com dose 20 mg” mostra a mesma corrente no servidor (422).

**Se perguntarem — “Como incluir uma regra nova?”** Cria-se outra classe que estende RegraSeguranca (por exemplo, interação entre remédios) e acrescenta-se um .encadear(new NovaRegra()). Nenhuma regra existente muda.

## 6. Builder — padrão extra

**Em uma frase:** Monta um objeto complexo passo a passo, separando a montagem das partes do resultado final.

**Comparação:** É montar um sanduíche no balcão: pão, recheio, molho, um passo de cada vez, e no fim ele é embrulhado.

**Problema que resolve no MedicalField:** A ficha em PDF tem várias seções (cabeçalho, paciente, ocorrência, avaliação, medicamentos, responsável), cada uma com sua formatação. Fazer tudo numa função só ficaria enorme e difícil de mudar.

**O builder guarda o conteúdo de cada seção** — `services/document-service/app/ficha/builder.py` (linhas 60–69)

```py
 60  # O BUILDER
 61  # Começa vazio (_ctx) e cada método preenche uma seção da ficha a partir dos dados do atendimento,
 62  # já formatando para leitura (datas em pt-BR, CPF com pontos, cor e significado da triagem).
 63  @dataclass
 64  class FichaAtendimentoBuilder:
 65      # Cada método preenche um pedaço do _ctx e devolve self: por isso dá para fazer .a().b().c()
 66      _ctx: dict = field(default_factory=dict)
 67  
 68      # Camada 1: número, data e a cor da triagem.
 69      def cabecalho(self, a: dict) -> FichaAtendimentoBuilder:
```

**build() gera o PDF; montar_ficha() define a ordem das seções** — `services/document-service/app/ficha/builder.py` (linhas 137–166)

```py
137      # Camada 6: quem atendeu.
138      def responsavel(self, nome: str) -> FichaAtendimentoBuilder:
139          self._ctx["responsavel"] = nome
140          return self
141  
142      # A ÚLTIMA ETAPA: junta todas as seções no template ficha.html (Jinja2) e o WeasyPrint
143      # converte o HTML em PDF. Devolve a Ficha pronta para download ou para anexar no e-mail.
144      def build(self, emitido_por: str) -> Ficha:
145          env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html"]))
146          self._ctx["emitido"] = f"{datetime.now(FUSO).strftime('%d/%m/%Y %H:%M')} por {emitido_por}"
147          html = env.get_template("ficha.html").render(**self._ctx)
148          pdf = HTML(string=html, base_url=str(TEMPLATES)).write_pdf()
149          return Ficha(pdf=pdf, nome_arquivo=f"ficha-atendimento-{self._ctx['numero'].lower()}.pdf")
150  
151  
152  def montar_ficha(detalhe: dict, emitido_por: str) -> Ficha:
153      """
154      O DIRETOR: decide a ordem das seções e chama o builder passo a passo.
155      É esta função que as rotas de PDF e de e-mail usam (routers.py).
156      """
157      return (
158          FichaAtendimentoBuilder()
159          .cabecalho(detalhe)
160          .paciente(detalhe["pessoa"], detalhe["prontuario"])
161          .ocorrencia(detalhe)
162          .avaliacao(detalhe)
163          .medicamentos(detalhe["medicamentos"], detalhe.get("medicamentosCatalogo") or [])
164          .responsavel(detalhe["profissionalNome"])
165          .build(emitido_por)
166      )
```

**Como funciona, passo a passo:**

1. FichaAtendimentoBuilder começa vazio e cada método preenche uma seção: cabecalho(), paciente(), ocorrencia(), avaliacao(), medicamentos(), responsavel().
2. Cada método devolve o próprio builder (return self), por isso dá para encadear com pontos.
3. build() junta tudo no template HTML (Jinja2) e converte para PDF (WeasyPrint).
4. montar_ficha() é o “diretor”: decide a ordem das seções num lugar só.

**Onde é usado:**

- `services/document-service/app/routers.py:33` — a rota /ficha/{id}/pdf chama montar_ficha

**Como mostrar ao vivo:** No portal, abra um atendimento → Gerar ficha (PDF). Ou, no Insomnia, “8. Ficha em PDF” → aba Preview.

**Se perguntarem — “Qual a vantagem?”** Separar como a ficha é montada (dados de cada seção) de como ela vira PDF. Para incluir uma seção nova, cria-se um método e uma linha no diretor.

## 7. Adapter — padrão extra

**Em uma frase:** Deixa classes diferentes serem usadas pela mesma interface, “traduzindo” cada uma para o formato esperado.

**Comparação:** É o adaptador de tomada: o aparelho é o mesmo, muda só o encaixe.

**Problema que resolve no MedicalField:** O e-mail com a ficha pode sair por um servidor SMTP de verdade (ou pela caixa de demonstração Mailpit) ou, em desenvolvimento, ser gravado como arquivo .eml. A rota de e-mail não deveria saber disso.

**A interface que a rota conhece** — `services/document-service/app/email/adapters.py` (linhas 42–47)

```py
 42  # A INTERFACE ("a tomada")
 43  # A rota de e-mail só conhece este método: enviar(mensagem) devolve o Message-ID.
 44  class EmailSender(Protocol):
 45      def enviar(self, m: Mensagem) -> str:
 46          """Entrega a mensagem e devolve o Message-ID."""
 47  
```

**Os dois adaptadores e a escolha** — `services/document-service/app/email/adapters.py` (linhas 62–100)

```py
 62  # ADAPTER 1 — SMTP
 63  # Traduz enviar() para o protocolo SMTP: conecta no servidor, faz login/TLS se configurado e envia.
 64  # Na VM, o servidor SMTP é o Mailpit (container "email"); a mensagem aparece em /email/.
 65  class SmtpEmailAdapter:
 66      def __init__(self, s: Settings):
 67          self.s = s
 68  
 69      def enviar(self, m: Mensagem) -> str:
 70          msg = montar(m, self.s.smtp_from)
 71          with smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=20) as smtp:
 72              if self.s.smtp_starttls:
 73                  smtp.starttls(context=ssl.create_default_context())
 74              if self.s.smtp_user:
 75                  smtp.login(self.s.smtp_user, self.s.smtp_password or "")
 76              smtp.send_message(msg)
 77          return msg["Message-ID"]
 78  
 79  
 80  # ADAPTER 2 — ARQUIVO
 81  # Traduz enviar() para "salvar um arquivo .eml" numa pasta. Usado quando não há SMTP configurado.
 82  class ArquivoEmailAdapter:
 83      """Sem SMTP configurado: grava o e-mail completo (com anexo) como .eml na caixa de saída."""
 84  
 85      def __init__(self, pasta: Path, remetente: str):
 86          self.pasta = pasta
 87          self.remetente = remetente
 88  
 89      def enviar(self, m: Mensagem) -> str:
 90          msg = montar(m, self.remetente)
 91          self.pasta.mkdir(parents=True, exist_ok=True)
 92          (self.pasta / f"{uuid.uuid4()}.eml").write_bytes(bytes(msg))
 93          return msg["Message-ID"]
 94  
 95  
 96  # A ESCOLHA DO ADAPTER
 97  # Lê a configuração: tem SMTP_HOST? Usa o SMTP. Não tem? Grava arquivo.
 98  # Trocar o Mailpit por um Gmail de verdade é só mudar as variáveis SMTP_*; nenhum código muda.
 99  def criar_sender(s: Settings) -> EmailSender:
100      return SmtpEmailAdapter(s) if s.smtp_host else ArquivoEmailAdapter(s.mail_outbox_dir, s.smtp_from)
```

**Como funciona, passo a passo:**

1. EmailSender é a interface: só tem enviar(mensagem) e devolve o Message-ID.
2. SmtpEmailAdapter traduz para o protocolo SMTP (com TLS e login, se configurados).
3. ArquivoEmailAdapter grava o e-mail completo, com o PDF anexo, como arquivo .eml.
4. criar_sender() escolhe pelo ambiente: com SMTP_HOST, usa SMTP; sem, usa arquivo. A rota só chama .enviar().

**Onde é usado:**

- `services/document-service/app/routers.py:65` — a rota de e-mail chama criar_sender(...).enviar(...)

**Como mostrar ao vivo:** No Insomnia, “9. Enviar ficha por e-mail” e depois abra http://<IP-da-VM>/email/: o e-mail chegou pelo SmtpEmailAdapter na caixa Mailpit.

**Se perguntarem — “E para usar Gmail?”** Basta preencher SMTP_HOST, usuário e senha no .env da VM. O código não muda: é o mesmo adaptador SMTP.
