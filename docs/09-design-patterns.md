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

**A interface e a implementação local (Dexie/IndexedDB)** — `apps/client/src/data/repositories.ts` (linhas 10–23)

```ts
 10  export interface Repository<T> {
 11    buscar(id: string): Promise<T | undefined>;
 12    listar(): Promise<T[]>;
 13  }
 14  
 15  class LocalRepository<T> implements Repository<T> {
 16    constructor(protected readonly tabela: Table<T, string>) {}
 17    async buscar(id: string) {
 18      return this.tabela.get(id);
 19    }
 20    async listar() {
 21      return this.tabela.toArray();
 22    }
 23  }
```

**Os repositórios prontos: local.* (aparelho) e remoto.* (API)** — `apps/client/src/data/repositories.ts` (linhas 46–65)

```ts
 46  export const local = {
 47    pessoas: new PessoasLocais(db.pessoas),
 48    prontuarios: new ProntuariosLocais(db.prontuarios),
 49    atendimentos: new AtendimentosLocais(db.atendimentos),
 50    medicamentos: new LocalRepository(db.medicamentos),
 51  };
 52  
 53  /** Repositório remoto: upsert idempotente (o opId da Outbox vai como Idempotency-Key). */
 54  class RemoteRepository<T> {
 55    constructor(private readonly rota: string) {}
 56    salvar(registro: unknown, opId: string) {
 57      return api<UpsertResponse<T>>('POST', this.rota, registro, opId);
 58    }
 59  }
 60  
 61  export const remoto = {
 62    pessoas: new RemoteRepository<PessoaLocal>('/pessoa'),
 63    prontuarios: new RemoteRepository<ProntuarioLocal>('/prontuario'),
 64    atendimentos: new RemoteRepository<AtendimentoLocal>('/atendimento'),
 65  };
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
- `apps/client/src/sync/commands.ts:33` — o envio para a central usa remoto.pessoas

**Como mostrar ao vivo:** Com a chave em Offline, abra Pacientes: a lista aparece mesmo sem internet, porque vem de local.pessoas.listar(). Para mostrar o banco por baixo: F12 → Application → IndexedDB → medicalfield-v2.

**Se perguntarem — “Por que não chamar a API direto na tela?”** Porque o sistema precisa funcionar offline: a tela sempre lê do aparelho. E se um dia trocarmos o Dexie por outro banco, só o repositório muda; as telas continuam iguais.

## 2. Strategy — exigido pela proposta

**Em uma frase:** Define uma família de algoritmos com a mesma “cara” (mesmo método) e deixa escolher qual usar em cada caso.

**Comparação:** É como regras de desempate: cada campeonato usa a sua, mas todas respondem à mesma pergunta “quem venceu?”.

**Problema que resolve no MedicalField:** Dois socorristas, cada um sem internet, editam o mesmo registro. Quando os dois sincronizam, a central recebe duas versões. Quem vence? A resposta depende do tipo de dado: para uma pessoa, vale a edição mais recente; para alergias, perder uma é perigoso; um atendimento registrado não deve mudar.

**A interface e as três estratégias** — `services/clinical-service/src/sync/strategies.ts` (linhas 13–54)

```ts
 13  export interface ConflictResolutionStrategy<T> {
 14    readonly nome: NomeEstrategia;
 15    resolve(servidor: T, recebido: T): T;
 16  }
 17  
 18  const recebidoMaisRecente = (s: ComRelogio, r: ComRelogio) =>
 19    Date.parse(r.atualizadoEmCliente) >= Date.parse(s.atualizadoEmCliente);
 20  
 21  /** Last-write-wins: vence a edição com o horário mais recente no aparelho. */
 22  export class LastWriteWinsStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
 23    readonly nome = 'LWW' as const;
 24    resolve(servidor: T, recebido: T): T {
 25      return recebidoMaisRecente(servidor, recebido) ? recebido : servidor;
 26    }
 27  }
 28  
 29  /**
 30   * Mescla: campos simples por last-write-wins e listas por união — uma alergia
 31   * registrada por qualquer equipe nunca se perde.
 32   */
 33  export class MergeStrategy<T extends ComRelogio> implements ConflictResolutionStrategy<T> {
 34    readonly nome = 'MESCLA' as const;
 35    private readonly lww = new LastWriteWinsStrategy<T>();
 36  
 37    constructor(private readonly listas: readonly (keyof T)[]) {}
 38  
 39    resolve(servidor: T, recebido: T): T {
 40      const out = { ...this.lww.resolve(servidor, recebido) };
 41      for (const campo of this.listas) {
 42        out[campo] = uniaoTermos(servidor[campo] as string[], recebido[campo] as string[]) as T[keyof T];
 43      }
 44      return out;
 45    }
 46  }
 47  
 48  /** O registro do servidor prevalece (atendimento registrado é imutável). */
 49  export class ServerWinsStrategy<T> implements ConflictResolutionStrategy<T> {
 50    readonly nome = 'SERVIDOR_VENCE' as const;
 51    resolve(servidor: T): T {
 52      return servidor;
 53    }
 54  }
```

**Quando existe conflito** — `services/clinical-service/src/sync/sync-support.ts` (linhas 24–24)

```ts
 24  export const houveConflito = (versaoServidor: number, baseVersion?: number | null) => (baseVersion ?? 0) < versaoServidor;
```

**O serviço de prontuário usando a estratégia** — `services/clinical-service/src/prontuario/prontuario.service.ts` (linhas 71–81)

```ts
 71      const servidor = prontuarioDeLinha(linha);
 72      const conflito = houveConflito(servidor.version!, recebido.baseVersion);
 73      const final = conflito ? this.estrategia.resolve(servidor, recebido) : recebido;
 74      const r = await tx.one(
 75        `UPDATE prontuario SET tipo_sanguineo=$2, alergias=$3, comorbidades=$4, observacoes=$5, atualizado_em_cliente=$6,
 76           sincronizado_em=now() WHERE id=$1 RETURNING *`,
 77        [final.id, final.tipoSanguineo, final.alergias, final.comorbidades, final.observacoes, final.atualizadoEmCliente],
 78      );
 79      const salvo = prontuarioDeLinha(r);
 80      if (conflito) await this.sync.registrarConflito(tx, 'PRONTUARIO', salvo.id, this.estrategia.nome, servidor, recebido, salvo);
 81      return { status: HttpStatus.OK, corpo: { resultado: conflito ? 'MESCLADO' : 'ATUALIZADO', registro: salvo } };
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

**O contrato do Observer** — `apps/client/src/sync/network.ts` (linhas 6–8)

```ts
  6  export interface NetworkObserver {
  7    onNetworkChange(online: boolean): void;
  8  }
```

**O Subject: NetworkMonitor guarda a lista de observers** — `apps/client/src/sync/network.ts` (linhas 20–35)

```ts
 20  export class NetworkMonitor {
 21    private observers = new Set<NetworkObserver>();
 22    private simuladorOnline = lerSimulador();
 23    private navegadorOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
 24  
 25    constructor() {
 26      if (typeof window !== 'undefined') {
 27        window.addEventListener('online', () => this.atualizar(() => (this.navegadorOnline = true)));
 28        window.addEventListener('offline', () => this.atualizar(() => (this.navegadorOnline = false)));
 29      }
 30    }
 31  
 32    subscribe(o: NetworkObserver): () => void {
 33      this.observers.add(o);
 34      return () => this.unsubscribe(o);
 35    }
```

**A chave Online/Offline muda o estado e chama notify()** — `apps/client/src/sync/network.ts` (linhas 53–74)

```ts
 53    /** Chave "Simular conectividade (Online / Offline)". */
 54    setSimulador(online: boolean) {
 55      this.atualizar(() => {
 56        this.simuladorOnline = online;
 57        try {
 58          localStorage.setItem(CHAVE, String(online));
 59        } catch {
 60          /* armazenamento indisponível: vale só nesta sessão */
 61        }
 62      });
 63    }
 64  
 65    private atualizar(muda: () => void) {
 66      muda();
 67      this.notify();
 68    }
 69  
 70    /** Avisa todos os observers; cada um decide o que fazer com a transição. */
 71    notify() {
 72      const online = this.isOnline();
 73      for (const o of this.observers) o.onNetworkChange(online);
 74    }
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
 28      network.subscribe(this);
```

**O que o Observer faz quando é avisado** — `apps/client/src/sync/engine.ts` (linhas 48–54)

```ts
 48    /** Observer: ao passar de offline para online, sincroniza sozinho. */
 49    onNetworkChange(online: boolean) {
 50      if (online === this.online) return;
 51      this.online = online;
 52      void registrarLog(online ? 'REDE_ONLINE' : 'REDE_OFFLINE');
 53      if (online) void this.sincronizar();
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

**Ao salvar: grava o registro e cria a operação na fila (Outbox), na mesma transação** — `apps/client/src/services/registro.ts` (linhas 33–38)

```ts
 33    await db.transaction('rw', tabela, db.outbox, async () => {
 34      await tabela.put({ ...registro, syncStatus: 'PENDENTE' } as T & Local);
 35      await db.outbox.add({ opId: novoId(), tipo, entidadeId: registro.id, status: 'PENDENTE', criadoEm: new Date().toISOString() });
 36    });
 37    await registrarLog(`${tipo}_${existente ? 'ALTERADO' : 'CRIADO'}`, { id: registro.id });
 38    syncEngine.solicitar();
```

**O comando e a fábrica que escolhe o comando certo para cada operação** — `apps/client/src/sync/commands.ts` (linhas 9–39)

```ts
  9  export interface OutboxCommand {
 10    execute(): Promise<void>;
 11  }
 12  
 13  class UpsertCommand<L extends { id: string; version?: number; syncStatus: string }> implements OutboxCommand {
 14    constructor(
 15      private readonly op: OperacaoOutbox,
 16      private readonly tabela: Table<L, string>,
 17      private readonly destino: { salvar(registro: unknown, opId: string): Promise<{ registro: unknown }> },
 18    ) {}
 19  
 20    async execute() {
 21      const registro = await this.tabela.get(this.op.entidadeId);
 22      if (!registro) return;
 23      const { syncStatus: _s, version, ...dados } = registro as L & { syncErro?: unknown };
 24      delete (dados as { syncErro?: unknown }).syncErro;
 25      const r = await this.destino.salvar({ ...dados, baseVersion: version ?? null }, this.op.opId);
 26      await this.tabela.put({ ...(r.registro as L), syncStatus: 'SINCRONIZADO' });
 27    }
 28  }
 29  
 30  export function comandoPara(op: OperacaoOutbox): OutboxCommand {
 31    switch (op.tipo) {
 32      case 'PESSOA':
 33        return new UpsertCommand(op, db.pessoas, remoto.pessoas);
 34      case 'PRONTUARIO':
 35        return new UpsertCommand(op, db.prontuarios, remoto.prontuarios);
 36      case 'ATENDIMENTO':
 37        return new UpsertCommand(op, db.atendimentos, remoto.atendimentos);
 38    }
 39  }
```

**O SyncEngine esvazia a fila executando os comandos** — `apps/client/src/sync/engine.ts` (linhas 92–105)

```ts
 92    private async executarEnvio() {
 93      if (!network.isOnline()) return;
 94      for (const op of await db.outbox.where('status').equals('PENDENTE').sortBy('seq')) {
 95        try {
 96          await comandoPara(op).execute();
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

- `apps/client/src/services/registro.ts:35` — db.outbox.add(...): cria o comando pendente
- `apps/client/src/sync/engine.ts:96` — comandoPara(op).execute(): executa o comando

**Como mostrar ao vivo:** No cliente, Offline: cadastre vítima, prontuário e atendimento. Abra Sincronizar: a tabela “Aguardando envio” mostra os 3 comandos na fila. Ligue a chave: os 3 são executados em ordem e a tabela fica vazia.

**Se perguntarem — “Por que não mandar direto para a API?”** Porque sem internet não dá. O comando guarda a intenção (“enviar esta pessoa”) para executar depois, em ordem e sem duplicar.

## 5. Chain of Responsibility — padrão extra

**Em uma frase:** Passa um pedido por uma corrente de verificadores; cada um confere a sua parte e pode barrar.

**Comparação:** É a fila de fiscais no aeroporto: documento, raio-x, alfândega. Qualquer um pode barrar.

**Problema que resolve no MedicalField:** Antes de dar um remédio, várias regras precisam ser conferidas (via permitida, dose máxima, alergia), e isso tem que funcionar sem internet. Colocar tudo num if gigante dificultaria incluir regras novas.

**O elo da corrente: avalia a sua regra e repassa para o próximo** — `packages/shared/src/clinical/safety.ts` (linhas 16–32)

```ts
 16  export abstract class RegraSeguranca {
 17    private proxima: RegraSeguranca | null = null;
 18  
 19    encadear(proxima: RegraSeguranca): RegraSeguranca {
 20      this.proxima = proxima;
 21      return proxima;
 22    }
 23  
 24    /** Avalia esta regra e repassa para a próxima, acumulando os alertas. */
 25    avaliar(ctx: ContextoAdministracao, alertas: string[] = []): string[] {
 26      const alerta = this.verificar(ctx);
 27      if (alerta) alertas.push(alerta);
 28      return this.proxima ? this.proxima.avaliar(ctx, alertas) : alertas;
 29    }
 30  
 31    protected abstract verificar(ctx: ContextoAdministracao): string | null;
 32  }
```

**As três regras (os elos)** — `packages/shared/src/clinical/safety.ts` (linhas 34–59)

```ts
 34  export class ViaRule extends RegraSeguranca {
 35    protected verificar({ medicamento, via }: ContextoAdministracao) {
 36      return medicamento.viasPermitidas.includes(via)
 37        ? null
 38        : `Via ${via} não permitida para ${medicamento.nome} (use ${medicamento.viasPermitidas.join(', ')}).`;
 39    }
 40  }
 41  
 42  export class DoseMaximaRule extends RegraSeguranca {
 43    protected verificar({ medicamento, dose }: ContextoAdministracao) {
 44      return dose <= medicamento.doseMaxima
 45        ? null
 46        : `Dose de ${dose} ${medicamento.unidade} acima da máxima de ${medicamento.nome} (${medicamento.doseMaxima} ${medicamento.unidade}).`;
 47    }
 48  }
 49  
 50  export class AlergiaRule extends RegraSeguranca {
 51    protected verificar({ medicamento, alergias }: ContextoAdministracao) {
 52      const termos = [medicamento.nome, ...medicamento.alergenos].map(normalizarTexto);
 53      const alergia = alergias.find((a) => {
 54        const n = normalizarTexto(a);
 55        return n.length > 2 && termos.some((t) => t.includes(n) || n.includes(t));
 56      });
 57      return alergia ? `Paciente alérgico a ${alergia}: ${medicamento.nome} não pode ser administrado.` : null;
 58    }
 59  }
```

**A corrente montada: via → dose máxima → alergia** — `packages/shared/src/clinical/safety.ts` (linhas 61–66)

```ts
 61  /** Via → dose máxima → alergia. */
 62  export function avaliarAdministracao(ctx: ContextoAdministracao): string[] {
 63    const cadeia = new ViaRule();
 64    cadeia.encadear(new DoseMaximaRule()).encadear(new AlergiaRule());
 65    return cadeia.avaliar(ctx);
 66  }
```

**Como funciona, passo a passo:**

1. RegraSeguranca é o elo abstrato. Cada elo guarda uma referência para o próximo (encadear).
2. avaliar(ctx) roda verificar() da regra atual; se houver problema, anota o alerta; depois repassa o mesmo pedido para o próximo elo.
3. ViaRule confere se a via (IV, IM, VO…) é permitida; DoseMaximaRule confere a dose; AlergiaRule compara as alergias do prontuário com o nome e os alérgenos do remédio.
4. avaliarAdministracao monta a corrente e devolve a lista de alertas. Lista vazia = pode administrar.
5. Ela fica em packages/shared, então o mesmo código roda no aparelho (offline, na tela) e no servidor (que recusa com 422 REGRA_CLINICA).

**Onde é usado:**

- `apps/client/src/ui/pages/AtendimentoForm.tsx:50` — no aparelho: ao clicar em Adicionar, bloqueia na hora (mesmo offline)
- `services/clinical-service/src/atendimento/atendimento.service.ts:127` — no servidor: confere de novo e responde 422 REGRA_CLINICA

**Como mostrar ao vivo:** No cliente, paciente João Pedro (alérgico a Dipirona) → Novo atendimento → Dipirona 1000 mg IV → Adicionar: aparece “Administração bloqueada”. Pelo Insomnia, “7. Atendimento com dose 20 mg” mostra a mesma corrente no servidor (422).

**Se perguntarem — “Como incluir uma regra nova?”** Cria-se outra classe que estende RegraSeguranca (por exemplo, interação entre remédios) e acrescenta-se um .encadear(new NovaRegra()). Nenhuma regra existente muda.

## 6. Builder — padrão extra

**Em uma frase:** Monta um objeto complexo passo a passo, separando a montagem das partes do resultado final.

**Comparação:** É montar um sanduíche no balcão: pão, recheio, molho, um passo de cada vez, e no fim ele é embrulhado.

**Problema que resolve no MedicalField:** A ficha em PDF tem várias seções (cabeçalho, paciente, ocorrência, avaliação, medicamentos, responsável), cada uma com sua formatação. Fazer tudo numa função só ficaria enorme e difícil de mudar.

**O builder guarda o conteúdo de cada seção** — `services/document-service/app/ficha/builder.py` (linhas 54–58)

```py
 54  @dataclass
 55  class FichaAtendimentoBuilder:
 56      _ctx: dict = field(default_factory=dict)
 57  
 58      def cabecalho(self, a: dict) -> FichaAtendimentoBuilder:
```

**build() gera o PDF; montar_ficha() define a ordem das seções** — `services/document-service/app/ficha/builder.py` (linhas 122–145)

```py
122      def responsavel(self, nome: str) -> FichaAtendimentoBuilder:
123          self._ctx["responsavel"] = nome
124          return self
125  
126      def build(self, emitido_por: str) -> Ficha:
127          env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html"]))
128          self._ctx["emitido"] = f"{datetime.now(FUSO).strftime('%d/%m/%Y %H:%M')} por {emitido_por}"
129          html = env.get_template("ficha.html").render(**self._ctx)
130          pdf = HTML(string=html, base_url=str(TEMPLATES)).write_pdf()
131          return Ficha(pdf=pdf, nome_arquivo=f"ficha-atendimento-{self._ctx['numero'].lower()}.pdf")
132  
133  
134  def montar_ficha(detalhe: dict, emitido_por: str) -> Ficha:
135      """Diretor: a ordem das seções da ficha."""
136      return (
137          FichaAtendimentoBuilder()
138          .cabecalho(detalhe)
139          .paciente(detalhe["pessoa"], detalhe["prontuario"])
140          .ocorrencia(detalhe)
141          .avaliacao(detalhe)
142          .medicamentos(detalhe["medicamentos"], detalhe.get("medicamentosCatalogo") or [])
143          .responsavel(detalhe["profissionalNome"])
144          .build(emitido_por)
145      )
```

**Como funciona, passo a passo:**

1. FichaAtendimentoBuilder começa vazio e cada método preenche uma seção: cabecalho(), paciente(), ocorrencia(), avaliacao(), medicamentos(), responsavel().
2. Cada método devolve o próprio builder (return self), por isso dá para encadear com pontos.
3. build() junta tudo no template HTML (Jinja2) e converte para PDF (WeasyPrint).
4. montar_ficha() é o “diretor”: decide a ordem das seções num lugar só.

**Onde é usado:**

- `services/document-service/app/routers.py:27` — a rota /ficha/{id}/pdf chama montar_ficha

**Como mostrar ao vivo:** No portal, abra um atendimento → Gerar ficha (PDF). Ou, no Insomnia, “8. Ficha em PDF” → aba Preview.

**Se perguntarem — “Qual a vantagem?”** Separar como a ficha é montada (dados de cada seção) de como ela vira PDF. Para incluir uma seção nova, cria-se um método e uma linha no diretor.

## 7. Adapter — padrão extra

**Em uma frase:** Deixa classes diferentes serem usadas pela mesma interface, “traduzindo” cada uma para o formato esperado.

**Comparação:** É o adaptador de tomada: o aparelho é o mesmo, muda só o encaixe.

**Problema que resolve no MedicalField:** O e-mail com a ficha pode sair por um servidor SMTP de verdade (ou pela caixa de demonstração Mailpit) ou, em desenvolvimento, ser gravado como arquivo .eml. A rota de e-mail não deveria saber disso.

**A interface que a rota conhece** — `services/document-service/app/email/adapters.py` (linhas 35–38)

```py
 35  class EmailSender(Protocol):
 36      def enviar(self, m: Mensagem) -> str:
 37          """Entrega a mensagem e devolve o Message-ID."""
 38  
```

**Os dois adaptadores e a escolha** — `services/document-service/app/email/adapters.py` (linhas 52–82)

```py
 52  class SmtpEmailAdapter:
 53      def __init__(self, s: Settings):
 54          self.s = s
 55  
 56      def enviar(self, m: Mensagem) -> str:
 57          msg = montar(m, self.s.smtp_from)
 58          with smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=20) as smtp:
 59              if self.s.smtp_starttls:
 60                  smtp.starttls(context=ssl.create_default_context())
 61              if self.s.smtp_user:
 62                  smtp.login(self.s.smtp_user, self.s.smtp_password or "")
 63              smtp.send_message(msg)
 64          return msg["Message-ID"]
 65  
 66  
 67  class ArquivoEmailAdapter:
 68      """Sem SMTP configurado: grava o e-mail completo (com anexo) como .eml na caixa de saída."""
 69  
 70      def __init__(self, pasta: Path, remetente: str):
 71          self.pasta = pasta
 72          self.remetente = remetente
 73  
 74      def enviar(self, m: Mensagem) -> str:
 75          msg = montar(m, self.remetente)
 76          self.pasta.mkdir(parents=True, exist_ok=True)
 77          (self.pasta / f"{uuid.uuid4()}.eml").write_bytes(bytes(msg))
 78          return msg["Message-ID"]
 79  
 80  
 81  def criar_sender(s: Settings) -> EmailSender:
 82      return SmtpEmailAdapter(s) if s.smtp_host else ArquivoEmailAdapter(s.mail_outbox_dir, s.smtp_from)
```

**Como funciona, passo a passo:**

1. EmailSender é a interface: só tem enviar(mensagem) e devolve o Message-ID.
2. SmtpEmailAdapter traduz para o protocolo SMTP (com TLS e login, se configurados).
3. ArquivoEmailAdapter grava o e-mail completo, com o PDF anexo, como arquivo .eml.
4. criar_sender() escolhe pelo ambiente: com SMTP_HOST, usa SMTP; sem, usa arquivo. A rota só chama .enviar().

**Onde é usado:**

- `services/document-service/app/routers.py:59` — a rota de e-mail chama criar_sender(...).enviar(...)

**Como mostrar ao vivo:** No Insomnia, “9. Enviar ficha por e-mail” e depois abra http://<IP-da-VM>/email/: o e-mail chegou pelo SmtpEmailAdapter na caixa Mailpit.

**Se perguntarem — “E para usar Gmail?”** Basta preencher SMTP_HOST, usuário e senha no .env da VM. O código não muda: é o mesmo adaptador SMTP.
