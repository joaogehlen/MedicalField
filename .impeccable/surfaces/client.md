# Surface: MedicalField Campo (apps/client)

Scope: aplicação do socorrista (PWA). Mode: **Operate**. Build path: code-led (tela de aplicativo).

Audience/job: registrar pessoa, prontuário e atendimento no local da ocorrência, online ou offline; sincronizar; gerar e enviar a ficha.
Important states: online, offline, sincronizando, pendente/sincronizado por registro, erro de sincronização, alerta clínico (bloqueante/aviso), vazio.
Constraints: luvas e estresse (alvos grandes), luz variável (contraste alto), telas de 390 px a tablet.

## Direction contract

THESIS: A ficha de APH em papel, digitalizada sem perder o que ela faz bem — campos na ordem da ocorrência, triagem visível de longe — e a rede tratada como estado do mundo, não como erro. Recusa o painel genérico de SaaS (cards de métrica, sidebar cinza, toast de "sem conexão").

OWN-WORLD: Fardamento e viatura do APH. Fundo papel frio (#F4F6F7), tinta azul-noite (#0F1B24), casca em azul-marinho de farda (#10283D). Cores de triagem reservadas ao significado (vermelho, laranja, amarelo, verde, azul, preto), sempre com o nome escrito. Atkinson Hyperlegible Next para tudo; Atkinson Hyperlegible Mono para medidas (PA, FC, SpO₂, doses, horários). Cantos de 6 px, traços de 1 px, sombras curtas e suaves.

STORY: O socorrista entra, vê suas ocorrências e o estado da rede; registra a vítima em poucos toques; percebe quando está offline sem ler nada; ao voltar o sinal, vê os registros pendentes virarem sincronizados sozinhos.

FIRST VIEWPORT: Casca azul-marinho no topo com o nome, a chave Online/Offline e o contador de pendentes. Abaixo, a lista de ocorrências do plantão: cada linha com a etiqueta de triagem, nome/queixa, horário em mono e o selo de sincronização. Ação primária "Nova ocorrência" fixa embaixo, ao alcance do polegar.

FORM: Sinalização refletiva de viatura (faixa chevron). Assinatura: quando offline, a casca ganha a faixa chevron âmbar/tinta da traseira da ambulância — o aparelho está "em campo, fora da rede" — e a chave mora nela. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
