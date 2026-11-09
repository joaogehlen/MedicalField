---
name: MedicalField
description: Prontuário de emergência offline-first — farda azul-marinho, papel frio e triagem que se lê de longe.
colors:
  farda: "#10283d"
  farda-2: "#1b3b57"
  papel: "#f4f6f7"
  folha: "#ffffff"
  folha-2: "#eaeef1"
  regua: "#cfd8de"
  regua-forte: "#9aa9b4"
  tinta: "#0f1b24"
  tinta-2: "#46555f"
  tinta-3: "#5f6e78"
  refletivo: "#f2b300"
  refletivo-escuro: "#1a1a1a"
  foco: "#ffb800"
  triagem-vermelho: "#c8102e"
  triagem-laranja: "#c2500a"
  triagem-amarelo: "#f2c200"
  triagem-verde: "#18794a"
  triagem-azul: "#1f5fc0"
  triagem-preto: "#1a1a1a"
  erro: "#b3261e"
  erro-fundo: "#fdecec"
  aviso-fundo: "#fff4d6"
  ok: "#18794a"
  ok-fundo: "#e5f4ec"
  pendente-fundo: "#fff1cc"
typography:
  titulo:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1.4375rem"
    fontWeight: 700
    lineHeight: 1.2
  secao:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
  corpo:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  rotulo:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.3
  medida:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  sm: "4px"
  md: "6px"
  pilula: "999px"
spacing:
  e1: "4px"
  e2: "8px"
  e3: "12px"
  e4: "16px"
  e6: "24px"
  e8: "32px"
  alvo: "48px"
components:
  button-primary:
    backgroundColor: "{colors.farda}"
    textColor: "{colors.folha}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.farda-2}"
  button-secondary:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    height: "40px"
  input:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "10px 12px"
  shell:
    backgroundColor: "{colors.farda}"
    textColor: "{colors.folha}"
    height: "60px"
  tag-triagem:
    textColor: "{colors.folha}"
    typography: "{typography.rotulo}"
    height: "26px"
  selo-pendente:
    backgroundColor: "{colors.pendente-fundo}"
    rounded: "{rounded.pilula}"
---

# Design System: MedicalField

## Overview

**Norte: farda e viatura do atendimento pré-hospitalar.** O sistema é usado de luvas, sob estresse, no sol da rodovia ou na cabine escura da ambulância. Por isso ele se parece com o mundo de quem atende, e não com um painel de SaaS: a casca de toda tela tem o azul-marinho da farda, o fundo é um papel frio de ficha, a tinta é azul-noite, e as cores de triagem aparecem só quando carregam significado, sempre com o nome escrito.

Duas superfícies compartilham o sistema. O **Campo** (cliente do socorrista) é confortável, com alvos de 48 px e uma coluna, pensado para celular e tablet. O **Portal** da regulação usa o mesmo mundo em densidade de escritório, com tabelas de linha baixa e corpo de 15 px.

A assinatura é a **faixa refletiva**. Quando o aparelho está fora da rede, a casca ganha a faixa chevron âmbar/preta da traseira da viatura: dá para perceber que está offline sem ler nada.

## Colors

### Primary
- **Farda** (`#10283d`): casca do app, barra do portal e botão primário. Ações primárias usam a farda, nunca uma cor de triagem.
- **Farda 2** (`#1b3b57`): hover e item ativo sobre a casca.

### Secondary
- **Refletivo** (`#f2b300`) com **preto refletivo** (`#1a1a1a`): só para o estado offline (faixa, chave, selo "Registrado offline") e para o sublinhado da navegação ativa. O amarelo de foco (`#ffb800`) aparece no anel de foco e na seleção de texto.

### Tertiary — triagem
Vermelho `#c8102e`, Laranja `#c2500a`, Amarelo `#f2c200` (texto em tinta), Verde `#18794a`, Azul `#1f5fc0`, Preto `#1a1a1a`. Todas passam AA com o texto da etiqueta. Elas vêm do START e do Manchester e não decoram nada.

### Neutral
Papel `#f4f6f7` (fundo), Folha `#ffffff` (superfícies), Folha 2 `#eaeef1` (cabeçalhos de tabela, segunda camada), Régua `#cfd8de` e Régua forte `#9aa9b4` (traços de 1 px), Tinta `#0f1b24`, Tinta 2 `#46555f` (secundário, 7:1), Tinta 3 `#5f6e78` (rótulos discretos).

### Named Rules
- **A cor de triagem nunca está sozinha.** Toda etiqueta escreve o nome ("Laranja · Muito urgente").
- **Alergia é vermelha e grande.** O bloco de alergias tem borda de 2 px vermelha e fundo rosado em toda tela onde há medicação.
- **Estado de sincronização tem vocabulário fixo:** "Só no aparelho" (âmbar, relógio), "Na central" (verde, check), "Recusado" (vermelho).

## Typography

Uma família só: **Atkinson Hyperlegible Next**, criada para legibilidade com baixa visão e que distingue I/l/1 e O/0. As medidas clínicas (PA, FC, SpO₂, doses, horários, CPF, IDs) usam **Atkinson Hyperlegible Mono**, com algarismos tabulares e zero cortado. As fontes são servidas pelo próprio projeto (@fontsource; no PDF, embutidas).

### Hierarchy
- Título de página 1.4375rem/700. No login e nos números grandes, 1.75rem.
- Título de seção 1rem/700, sobre um traço de 1 px na cor da farda (a régua da ficha em papel).
- Corpo 1rem/1.45 no Campo; 15 px no Portal.
- Rótulos 0.875rem/700. Rótulos de dado (dt) 0.75rem em Tinta 3.
- Escala fixa em rem (razão ~1,2), sem tipografia fluida.

## Layout

- **Campo:** coluna única de até 980 px; navegação inferior com 3 destinos abaixo de 900 px, e no topo acima disso. A ação primária fica na barra fixa inferior dos formulários, ao alcance do polegar.
- **Portal:** largura de até 1320 px, filtros em linha sobre a tabela e detalhe em duas colunas (paciente e ocorrência) que viram uma abaixo de 900 px.
- Espaçamento em base 4 px (4/8/12/16/20/24/32/48). Há mais espaço acima de um título de seção do que abaixo.
- Campo-dado: pares rótulo/valor numa grade `auto-fill minmax(160px)` com régua inferior de 1 px, como os campos da ficha impressa.

## Elevation & Depth

Profundidade discreta e sempre com deslocamento. `sombra-1` (0 1px 2px) em cartões e botões primários; `sombra-2` (0 4px 12px −2px) na casca e no hover dos cartões; `sombra-3` (0 12px 32px −6px) só na barra de ações fixa. Não há brilho colorido nem sombra dura.

## Shapes

Cantos de 6 px em superfícies, botões e campos; 4 px nos selos pequenos; pílula nos selos de estado e nos chips de termos. A etiqueta de triagem tem forma própria: canto reto de 4 px de um lado, arredondado de 13 px do outro, e um ilhós (furo) circular, como a tag presa ao punho da vítima.

## Components

### Buttons
Primário na farda com texto branco; secundário branco com régua forte; perigo branco com texto e borda de erro; fantasma sem borda. A altura é 40 px no Portal e 48 px (`btn-grande`) nas ações do Campo. Ao carregar, o rótulo some e um giro de 16 px aparece no lugar, sem mudar a largura.

### Chips
Termos clínicos (alergias, comorbidades, procedimentos) são pílulas cinza com botão de remover de 28 px. As sugestões aparecem como pílulas tracejadas que viram sólidas no hover.

### Cards / Containers
`painel`: fundo Folha, régua de 1 px, raio de 6 px, sem aninhamento. Cada ocorrência da lista do Campo é um cartão de 72 px com etiqueta, nome, queixa, hora em mono e selos.

### Inputs / Fields
44 px de altura, régua forte; no foco, borda farda e anel amarelo de foco. Campo inválido ganha borda e fundo de erro, com a mensagem abaixo e em negrito. Medidas usam mono, com a unidade dentro do campo à direita. Sinais vitais fora da faixa de referência ganham borda laranja.

### Navigation
Casca azul-marinho com a marca (cruz branca) e a navegação, em que o item ativo tem sublinhado refletivo. No Campo, a casca também traz o contador de pendentes e a **chave Online/Offline**: verde quando online; quando offline, a chave inteira fica amarela refletiva.

### Etiqueta de triagem (assinatura)
`.tag-triagem[data-cor]`: forma de tag com ilhós, cor do protocolo e nome escrito. A escolha da classificação no formulário usa botões grandes com uma faixa de 6 px na cor da triagem, que se preenchem por inteiro quando marcados.

### Faixa refletiva (assinatura)
`.faixa-refletiva`: 12 px de listras a −45° (âmbar/preto) sob a casca quando offline, com transição de altura de 220 ms. A miniatura `.selo-offline` marca registros que nasceram sem rede no Campo e no Portal (no PDF, como selo âmbar com contorno).

## Do's and Don'ts

### Do:
- **Do** escrever o nome da classificação em toda etiqueta de triagem.
- **Do** usar mono para qualquer número clínico, horário, CPF ou identificador.
- **Do** mostrar o estado de sincronização em cada registro e na casca.
- **Do** manter as alergias visíveis acima de qualquer formulário de medicação.
- **Do** escrever na língua do APH: ocorrência, vítima, regulação, viatura.

### Don't:
- **Don't** usar cor de triagem para decorar, para ação primária ou para marca.
- **Don't** usar toast para avisar "sem conexão": o estado offline é a faixa refletiva, que é permanente enquanto durar.
- **Don't** criar cartões de métrica (número grande + rótulo) para preencher telas. O Portal começa pela tabela.
- **Don't** usar borda lateral colorida em cartões ou alertas; o alerta tem borda de 1 px inteira e fundo tingido.
- **Don't** usar eyebrow/kicker acima de títulos nem numerar seções.
