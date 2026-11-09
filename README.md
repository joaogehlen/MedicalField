# MedicalField — Prontuário Médico de Emergência

Trabalho final de **4815206 – Arquiteturas de Software** (Univates, 2026/B).

O socorrista registra a ficha de atendimento pré-hospitalar no aparelho **mesmo sem internet**: sinais vitais, Escala de Glasgow, triagem START/Manchester e medicamentos, com as regras de segurança clínica rodando no próprio aparelho. Quando a conexão volta, tudo é sincronizado com a central de forma **idempotente**, **auditável** e com **resolução de conflitos**. A central acompanha pelo portal, emite a ficha em PDF e a envia por e-mail ao familiar.

![Cliente offline com três registros pendentes](docs/capturas/12c-cliente-offline-pendentes.png)

## Arquitetura

```mermaid
flowchart LR
    client["📱 Campo (PWA)<br/>React + IndexedDB"] --> gw
    portal["💻 Portal<br/>React"] --> gw
    gw["Nginx<br/>gateway"] --> id["identity-service<br/>Java · Spring Boot"]
    gw --> cl["clinical-service<br/>TypeScript · NestJS"]
    gw --> doc["document-service<br/>Python · FastAPI"]
    id & cl & doc --> pg[("PostgreSQL<br/>schema por serviço")]
    doc --> cl
    doc --> smtp[("SMTP")]
```

| Componente | Stack | Papel |
|---|---|---|
| `apps/client` | TypeScript · React · Dexie | Ficha offline-first, chave Online/Offline, Outbox, sincronização, login offline |
| `apps/portal` | TypeScript · React | Regulação: atendimentos, prontuários, cadastros, auditoria |
| `packages/shared` | TypeScript · zod | Tipos, validações e `ClinicalSafetyChain`, usados pelo cliente e pelo servidor |
| `packages/design` | CSS | Tokens e componentes visuais ([DESIGN.md](DESIGN.md)) |
| `services/identity-service` | **Java 21** · Spring Boot | Login CRM/COREN/Socorrista, JWT RS256, logs do aparelho |
| `services/clinical-service` | **TypeScript** · NestJS | Núcleo clínico, idempotência, conflitos, pull por cursor |
| `services/document-service` | **Python** · FastAPI | Ficha em PDF e e-mail com anexo |

Padrões de projeto: **Repository**, **Strategy** e **Observer** (exigidos), mais **Command**, **Chain of Responsibility**, **Builder** e **Adapter**.

## Rodar

```bash
infra/scripts/start-all.sh          # banco, build, três serviços e Nginx
# Cliente:  http://localhost:8080/app/       CRM 12345 / RS · senha medicalfield
# Portal:   http://localhost:8080/portal/    ID Socorrista 0001 · senha medicalfield
# API:      http://localhost:8080/api        (coleção em postman/)
```

Na VM da Univates: `sudo infra/scripts/deploy-vm.sh` ([guia](docs/07-implantacao-vm.md)).

## Roteiro de testes

Os 17 passos oficiais rodam automaticamente no navegador, com portal e cliente lado a lado, e estão **aprovados 17/17**:

```bash
infra/scripts/reset-db.sh && infra/scripts/start-all.sh
cd tests/e2e && npm install && npx playwright install chromium && node roteiro.mjs
```

## Documentação

| # | Documento | Conteúdo |
|---|---|---|
| 01 | [Extração da proposta](docs/01-proposta.md) | Requisitos e onde cada um foi implementado |
| 02 | [Arquitetura](docs/02-arquitetura.md) | **E1** — diagramas, tecnologias, segurança, padrões, ADRs |
| 03 | [Offline-first e sincronização](docs/03-sincronizacao-offline.md) | Simulador, Outbox, pull por cursor, conflitos, regras clínicas offline |
| 04 | [APIs](docs/04-apis.md) | **E2** — rotas e contratos dos três serviços |
| 05 | [Banco de dados](docs/05-banco-de-dados.md) | **E2** — PostgreSQL (três schemas) e IndexedDB |
| 06 | [Roteiro de testes](docs/06-roteiro-testes.md) | **E3** — 17 passos, capturas e testes automatizados |
| 07 | [Implantação na VM](docs/07-implantacao-vm.md) | Nginx, systemd, e-mail, operação |
| 08 | [Desenvolvimento](docs/08-desenvolvimento.md) | Estrutura do código e testes |
| — | [DESIGN.md](DESIGN.md) · [PRODUCT.md](PRODUCT.md) | Sistema de design (Impeccable) |

Todos os pacientes e dados pessoais do sistema são fictícios.
