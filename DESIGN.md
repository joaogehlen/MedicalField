---
name: MedicalField
description: Prontuário de emergência offline-first — tema claro sobre Bootstrap, azul hospitalar, fotos reais do SAMU e triagem que se lê de longe.
colors:
  azul: "#1559a8"
  azul-hover: "#114a8c"
  azul-claro: "#eaf2fb"
  titulo: "#0e2a47"
  tinta: "#14263a"
  tinta-2: "#51606f"
  fundo: "#f4f7fb"
  folha: "#ffffff"
  borda: "#dfe6ee"
  marca-vermelho: "#d0263a"
  triagem-vermelho: "#c8102e"
  triagem-laranja: "#c2500a"
  triagem-amarelo: "#f2c200"
  triagem-verde: "#18794a"
  triagem-azul: "#1f5fc0"
  triagem-preto: "#1a1a1a"
  alergia-fundo: "#fdebee"
  alergia-texto: "#9b1426"
  offline-faixa: "#f2b300"
typography:
  familia: "Atkinson Hyperlegible Next, system-ui, sans-serif"
  medidas: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
  titulos: "700, letter-spacing -0.01em"
rounded:
  padrao: "0.6rem"
  grande: "0.9rem"
  pilula: "999px"
framework: "Bootstrap 5.3.3 + Bootstrap Icons 1.11.3"
---

# MedicalField — sistema de design

## 1. Direção

Tema **claro**, limpo e hospitalar: fundo azul-acinzentado bem claro, cartões brancos, ações em azul. O vermelho da cruz fica só na marca; as cores fortes são reservadas à **classificação de risco** (sempre com o nome escrito) e às **alergias**. Fotos reais de ambulâncias do SAMU dão contexto no login e no topo da tela inicial.

A base é o **Bootstrap 5.3** (grid, cartões, formulários, tabelas, badges, `btn-check`, `form-switch`), personalizado por variáveis CSS em `packages/design/theme.css`. Não há CSS por tela: as telas usam só classes do Bootstrap e as poucas classes próprias abaixo.

## 2. Tokens

| Token | Valor | Uso |
|---|---|---|
| `--mf-azul` | `#1559a8` | botões primários, links, item ativo do menu (`--bs-primary`) |
| `--mf-fundo` | `#f4f7fb` | fundo da página (`--bs-body-bg`) |
| `--mf-titulo` / `--mf-tinta` | `#0e2a47` / `#14263a` | títulos / texto |
| `--mf-tinta-2` | `#51606f` | texto secundário (`--bs-secondary-color`) |
| `--mf-borda` | `#dfe6ee` | bordas de cartões e tabelas |
| `--mf-vermelho` | `#d0263a` | só o quadrado da cruz na marca |
| `--t-*` | vermelho, laranja, amarelo, verde, azul, preto | classificação de risco (START / Manchester) |

Fontes: **Atkinson Hyperlegible Next** (texto, projetada para baixa visão) e **Atkinson Hyperlegible Mono** (medidas, horários e CPF, com algarismos tabulares).

## 3. Classes próprias (`theme.css`)

| Classe | O que é |
|---|---|
| `.navbar-mf` | barra superior branca com menu em pílulas (ativo em azul claro) |
| `.marca`, `.marca-cruz` | logotipo: cruz branca em quadrado vermelho + “MedicalField” |
| `.triagem[data-cor]` | etiqueta de classificação: pílula na cor, com bolinha e o **nome escrito** |
| `.btn.escolha-cor[data-cor]` | botão de escolha da classificação (borda grossa na cor; preenchido quando marcado) |
| `.alergias` | faixa vermelho-clara com ícone e “Alergias: …” — aparece em todas as telas do paciente |
| `.faixa-offline` | faixa amarela e preta (refletivo de viatura) sob a barra quando o aparelho está offline |
| `.badge-offline` | selo “Registrado offline” |
| `.login-foto`, `.banner`, `.foto-cover` | foto com degradê azul-escuro para texto branco legível |
| `.card-link-hover`, `.vazio` | cartão clicável com elevação; estado vazio com ícone |

## 4. Telas

**Cliente (socorrista)** — `/app`
- *Entrar*: foto da ambulância à esquerda (some no celular), formulário à direita com CRM / COREN / Socorrista em `btn-group` e a chave Online/Offline.
- *Atendimentos*: banner com foto da frota, “Receber dados” e “Nova ocorrência”; lista de cartões com etiqueta de triagem, paciente, queixa, horário e selo de sincronização.
- *Nova ocorrência*: três etapas (Vítima → Prontuário → Atendimento) indicadas por pílulas.
- *Atendimento*: cartões Ocorrência, Classificação de risco, Glasgow (com total e gravidade), Sinais vitais (com unidades), Medicamentos (bloqueio em `alert-danger` quando a regra clínica falha) e Observações.
- *Sincronizar*: chave, último envio/recebimento, contadores do aparelho e a fila de pendentes.

**Portal (central)** — `/portal`
- *Entrar*: formulário à esquerda, foto do interior da ambulância à direita.
- *Atendimentos* e *Prontuários*: tabelas com busca; linha inteira clicável.
- *Detalhe do atendimento*: cartões do paciente e da avaliação; à direita, “Gerar ficha (PDF)” e o envio por e-mail com o contato do familiar já preenchido.
- *Cadastros*: abas Medicamentos e Profissionais.

## 5. Regras

1. A cor de triagem **sempre** vem com o nome escrito (nunca só cor).
2. Alergias sempre visíveis em vermelho no topo das telas do paciente.
3. O estado da rede está sempre na barra superior: chave verde (Online) ou amarela (Offline) + faixa amarela e preta + contador de pendentes.
4. Cada registro mostra onde está: “Na central”, “Só no aparelho” ou “Recusado”.
5. Contraste AA; alvos de toque grandes (`btn-lg` nas ações principais); layout responsivo de 390 px a desktop.

## 6. Imagens

Fotos do Wikimedia Commons em domínio público, reduzidas para 1280 px, em `packages/design/img/` — créditos em [`CREDITOS.md`](packages/design/img/CREDITOS.md) e na própria tela de login.
