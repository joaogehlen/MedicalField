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

**A interface e a implementação local (Dexie/IndexedDB)** — `apps/client/src/data/repositories.ts` (linhas 14–33)

```ts
 14  // O CONTRATO
 15  // Todo repositório sabe fazer duas coisas: buscar um registro pelo id e listar todos.
 16  // A tela só conhece estes dois métodos; não sabe se por trás tem IndexedDB, API ou outra coisa.
 17  export interface Repository<T> {
 18    buscar(id: string): Promise<T | undefined>;
 19    listar(): Promise<T[]>;
 20  }
 21  
 22  // O REPOSITÓRIO LOCAL
 23  // Recebe uma tabela do IndexedDB (o banco do navegador) e implementa o contrato em cima dela:
 24  // buscar = tabela.get(id), listar = tabela.toArray(). Funciona sem internet, porque é tudo no aparelho.
 25  class LocalRepository<T> implements Repository<T> {
 26    constructor(protected readonly tabela: Table<T, string>) {}
 27    async buscar(id: string) {
 28      return this.tabela.get(id);
 29    }
 30    async listar() {
 31      return this.tabela.toArray();
 32    }
 33  }
```

**Os repositórios prontos: local.* (aparelho) e remoto.* (API)** — `apps/client/src/data/repositories.ts` (linhas 59–84)

```ts
 59  // O QUE AS TELAS USAM
 60  // Um repositório pronto para cada tabela. A tela chama, por exemplo, local.pessoas.listar()
 61  // e recebe a lista, sem nenhuma linha de código de banco de dados.
 62  export const local = {
 63    pessoas: new PessoasLocais(db.pessoas),
 64    prontuarios: new ProntuariosLocais(db.prontuarios),
 65    atendimentos: new AtendimentosLocais(db.atendimentos),
 66    medicamentos: new LocalRepository(db.medicamentos),
 67  };
 68  
 69  // O REPOSITÓRIO REMOTO (a central)
 70  // Salvar = um POST na API. O opId vai como Idempotency-Key: se a internet cair no meio e o
 71  // mesmo envio for repetido, a central reconhece a chave e não grava duas vezes.
 72  class RemoteRepository<T> {
 73    constructor(private readonly rota: string) {}
 74    salvar(registro: unknown, opId: string) {
 75      return api<UpsertResponse<T>>('POST', this.rota, registro, opId);
 76    }
 77  }
 78  
 79  // Quem usa o remoto é só o envio para a central (commands.ts). As telas nunca chamam a API direto.
 80  export const remoto = {
 81    pessoas: new RemoteRepository<PessoaLocal>('/pessoa'),
 82    prontuarios: new RemoteRepository<ProntuarioLocal>('/prontuario'),
 83    atendimentos: new RemoteRepository<AtendimentoLocal>('/atendimento'),
 84  };
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
- `apps/client/src/sync/commands.ts:48` — o envio para a central usa remoto.pessoas

**Como mostrar ao vivo:** Com a chave em Offline, abra Pacientes: a lista aparece mesmo sem internet, porque vem de local.pessoas.listar(). Para mostrar o banco por baixo: F12 → Application → IndexedDB → medicalfield-v2.

**Se perguntarem — “Por que não chamar a API direto na tela?”** Porque o sistema precisa funcionar offline: a tela sempre lê do aparelho. E se um dia trocarmos o Dexie por outro banco, só o repositório muda; as telas continuam iguais.

## 2. Strategy — exigido pela proposta

**Em uma frase:** Define uma família de algoritmos com a mesma “cara” (mesmo método) e deixa escolher qual usar em cada caso.

**Comparação:** É como regras de desempate: cada campeonato usa a sua, mas todas respondem à mesma pergunta “quem venceu?”.

**Problema que resolve no MedicalField:** Dois socorristas, cada um sem internet, editam o mesmo registro. Quando os dois sincronizam, a central recebe duas versões. Quem vence? A resposta depende do tipo de dado: para uma pessoa, vale a edição mais recente; para alergias, perder uma é perigoso; um atendimento registrado não deve mudar.

**A interface e as três estratégias** — `services/clinical-service/src/sync/strategies.ts` (linhas 20–68)

```ts
 20  // O CONTRATO
 21  // Toda estratégia recebe as duas versões do registro (a que está no banco e a que acabou de chegar)
 22  // e devolve a versão final. O "nome" vai para o histórico de conflitos (tabela sync_conflito).
 23  export interface ConflictResolutionStrategy<T> {
 24    readonly nome: NomeEstrategia;
 25    resolve(servidor: T, recebido: T): T;
 26  }
 27  
 28  const recebidoMaisRecente = (s: ComRelogio, r: ComRelogio) =>
 29    Date.parse(r.atualizadoEmCliente) >= Date.parse(s.atualizadoEmCliente);
 30  
 31  // ESTRATÉGIA 1 — LAST WRITE WINS (usada em Pessoa)
 32  // Compara o horário em que cada aparelho fez a edição (atualizadoEmCliente).
 33  // Fica a versão editada por último; a outra é descartada.
 34  export class LastWriteWinsStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
 35    readonly nome = 'LWW' as const;
 36    resolve(servidor: T, recebido: T): T {
 37      return recebidoMaisRecente(servidor, recebido) ? recebido : servidor; // o horário mais novo vence
 38    }
 39  }
 40  
 41  // ESTRATÉGIA 2 — MESCLA (usada em Prontuário)
 42  // Campos simples (tipo sanguíneo, observações): vence o mais recente, igual à estratégia 1.
 43  // Listas (alergias, comorbidades): junta as duas versões. Se uma equipe anotou "Penicilina" e
 44  // outra anotou "Látex", ficam as duas: perder uma alergia seria perigoso para o paciente.
 45  export class MergeStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
 46    readonly nome = 'MESCLA' as const;
 47    private readonly lww = new LastWriteWinsStrategy<T>();
 48  
 49    constructor(private readonly listas: readonly (keyof T)[]) {}
 50  
 51    resolve(servidor: T, recebido: T): T {
 52      const out = { ...this.lww.resolve(servidor, recebido) }; // 1) campos simples: o mais novo vence
 53      for (const campo of this.listas) { // 2) listas (alergias, comorbidades): junta as duas, sem repetir
 54        out[campo] = uniaoTermos(servidor[campo] as string[], recebido[campo] as string[]) as T[keyof T];
 55      }
 56      return out;
 57    }
 58  }
 59  
 60  // ESTRATÉGIA 3 — SERVIDOR VENCE (usada em Atendimento)
 61  // Um atendimento já registrado na central é um documento: não pode ser trocado depois.
 62  // Então o que chegou é ignorado e fica a versão que já estava no banco.
 63  export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
 64    readonly nome = 'SERVIDOR_VENCE' as const;
 65    resolve(servidor: T): T {
 66      return servidor; // ignora o que chegou: fica o que já está na central
 67    }
 68  }
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

**O contrato do Observer** — `apps/client/src/sync/network.ts` (linhas 9–14)

```ts
  9  // O OBSERVER
 10  // Quem quiser ser avisado da rede implementa este único método. O SyncEngine (engine.ts) e a
 11  // barra da tela fazem isso.
 12  export interface NetworkObserver {
 13    onNetworkChange(online: boolean): void;
 14  }
```

**O Subject: NetworkMonitor guarda a lista de observers** — `apps/client/src/sync/network.ts` (linhas 26–46)

```ts
 26  // O SUBJECT
 27  // Guarda a lista de observers e dois estados: a internet real do navegador e a chave
 28  // Online/Offline da tela. Só está "online" quando os dois estão ligados.
 29  export class NetworkMonitor {
 30    private observers = new Set<NetworkObserver>();
 31    private simuladorOnline = lerSimulador();
 32    private navegadorOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
 33  
 34    constructor() {
 35      // O navegador avisa quando a internet de verdade cai ou volta.
 36      if (typeof window !== 'undefined') {
 37        window.addEventListener('online', () => this.atualizar(() => (this.navegadorOnline = true)));
 38        window.addEventListener('offline', () => this.atualizar(() => (this.navegadorOnline = false)));
 39      }
 40    }
 41  
 42    // INSCRIÇÃO: coloca o observer na lista. Devolve uma função que tira ele da lista depois.
 43    subscribe(o: NetworkObserver): () => void {
 44      this.observers.add(o);
 45      return () => this.unsubscribe(o);
 46    }
```

**A chave Online/Offline muda o estado e chama notify()** — `apps/client/src/sync/network.ts` (linhas 64–87)

```ts
 64    // A chave Online/Offline da tela (para simular a falta de internet na apresentação).
 65    setSimulador(online: boolean) {
 66      this.atualizar(() => {
 67        this.simuladorOnline = online;
 68        try {
 69          localStorage.setItem(CHAVE, String(online));
 70        } catch {
 71          /* armazenamento indisponível: vale só nesta sessão */
 72        }
 73      });
 74    }
 75  
 76    // Toda mudança (internet real ou chave da tela) passa por aqui: muda o estado e chama notify().
 77    private atualizar(muda: () => void) {
 78      muda();
 79      this.notify();
 80    }
 81  
 82    // O AVISO: percorre a lista e chama onNetworkChange(online) em cada observer.
 83    // O monitor não sabe o que cada um faz com o aviso; o SyncEngine, por exemplo, envia a fila.
 84    notify() {
 85      const online = this.isOnline();
 86      for (const o of this.observers) o.onNetworkChange(online);
 87    }
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

**O comando e a fábrica que escolhe o comando certo para cada operação** — `apps/client/src/sync/commands.ts` (linhas 13–54)

```ts
 13  // O CONTRATO
 14  // Um comando é qualquer objeto que sabe se executar. Quem executa (o SyncEngine) não precisa
 15  // saber se é uma pessoa, um prontuário ou um atendimento.
 16  export interface OutboxCommand {
 17    execute(): Promise<void>;
 18  }
 19  
 20  // O COMANDO
 21  // Guarda o pedido da fila (op), a tabela do aparelho e o destino na central.
 22  // Ele envia o estado ATUAL do registro: se a pessoa foi editada 3 vezes offline, vai a última versão.
 23  class UpsertCommand<L extends { id: string; version?: number; syncStatus: string }> implements OutboxCommand {
 24    constructor(
 25      private readonly op: OperacaoOutbox,
 26      private readonly tabela: Table<L, string>,
 27      private readonly destino: { salvar(registro: unknown, opId: string): Promise<{ registro: unknown }> },
 28    ) {}
 29  
 30    // EXECUTAR: 1) pega o registro no aparelho  2) envia à central com a baseVersion (para detectar
 31    // conflito)  3) grava a resposta da central no aparelho, marcada como SINCRONIZADO.
 32    async execute() {
 33      const registro = await this.tabela.get(this.op.entidadeId);
 34      if (!registro) return;
 35      const { syncStatus: _s, version, ...dados } = registro as L & { syncErro?: unknown };
 36      delete (dados as { syncErro?: unknown }).syncErro;
 37      const r = await this.destino.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
 38      await this.tabela.put({ ...(r.registro as L), syncStatus: 'SINCRONIZADO' });
 39    }
 40  }
 41  
 42  // A FÁBRICA
 43  // Lê o tipo do item da fila e monta o comando certo, já ligado à tabela e à rota da API certas.
 44  // O SyncEngine só faz: comandoPara(item).execute().
 45  export function comandoPara(op: OperacaoOutbox): OutboxCommand {
 46    switch (op.tipo) {
 47      case 'PESSOA':
 48        return new UpsertCommand(op, db.pessoas, remoto.pessoas);
 49      case 'PRONTUARIO':
 50        return new UpsertCommand(op, db.prontuarios, remoto.prontuarios);
 51      case 'ATENDIMENTO':
 52        return new UpsertCommand(op, db.atendimentos, remoto.atendimentos);
 53    }
 54  }
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
