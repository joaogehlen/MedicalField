# 08 — Estrutura do Código e Desenvolvimento

## 1. Monorepo

```
MedicalField/
├── apps/
│   ├── client/                 # Cliente do socorrista — React + Bootstrap + Dexie
│   │   └── src/
│   │       ├── data/           # db.ts (IndexedDB) · repositories.ts (Repository local/remoto)
│   │       ├── sync/           # network.ts (Observer) · commands.ts (Command) · engine.ts (SyncEngine)
│   │       ├── services/       # registro.ts (grava local + Outbox) · logs.ts
│   │       ├── auth/           # sessão do profissional
│   │       ├── api/            # cliente HTTP (simulador, JWT, Idempotency-Key)
│   │       └── ui/             # Layout, telas (pages/) e componentes
│   └── portal/                 # Portal da central — React + Bootstrap
├── packages/
│   ├── shared/                 # tipos, schemas zod, escalas, regras clínicas (+ testes)
│   └── design/                 # theme.css (tema sobre Bootstrap) · fontes · img/ (fotos e créditos)
├── services/
│   ├── identity-service/       # Java 21 · Spring Boot (Maven)
│   ├── clinical-service/       # TypeScript · NestJS (migrations/, seeds/, src/)
│   └── document-service/       # Python · FastAPI (app/, migrations/, tests/)
├── infra/
│   ├── db/                     # init.sql · roteiro/passo-09-novos-medicamentos.sql
│   ├── nginx/                  # medicalfield.conf.template
│   ├── systemd/                # units dos três serviços
│   └── scripts/                # setup-dev · start-all · stop-all · reset-db · deploy-vm · render-nginx
├── tests/e2e/                  # roteiro de 17 passos (Playwright)
├── postman/                    # coleção da API
├── docs/                       # esta documentação (E1, E2, E3)
├── DESIGN.md · PRODUCT.md      # sistema de design e produto (Impeccable)
└── .impeccable/                # contratos de direção visual por superfície
```

## 2. Rodando localmente

Pré-requisitos: Node 22, Java 21 + Maven, Python 3.12+, PostgreSQL 16 e Nginx.

```bash
infra/scripts/start-all.sh
# Cliente:  http://localhost:8080/app/
# Portal:   http://localhost:8080/portal/
# API:      http://localhost:8080/api
```

Para trabalhar só no front-end com recarga automática, deixe o backend no ar e rode `npm run dev -w @medicalfield/client` (porta 5173) ou `npm run dev -w @medicalfield/portal` (5174); o Vite repassa `/api` ao Nginx.

## 3. Testes

```bash
npm test -w @medicalfield/shared
npm test -w @medicalfield/clinical-service                       # unitários
E2E_URL=http://127.0.0.1:3001 JWT_PRIVATE_KEY_PATH=$PWD/.runtime/keys/jwt-private.pem \
  npm test -w @medicalfield/clinical-service                     # + e2e contra o serviço
(cd services/identity-service && mvn test)
(cd services/document-service && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/pytest)
(cd tests/e2e && npm install && node roteiro.mjs)                # roteiro completo
```

## 4. Design (Impeccable + Bootstrap)

As telas usam **Bootstrap 5.3** e **Bootstrap Icons**, com o tema claro de `packages/design/theme.css` (cores, fontes Atkinson Hyperlegible, etiqueta de triagem, faixa offline). O direcionamento visual segue a skill **Impeccable**: `PRODUCT.md` (produto e usuários), `.impeccable/surfaces/*.md` (direção de cada superfície) e `DESIGN.md` (sistema construído). Ao criar uma tela nova, use componentes do Bootstrap e as classes de `theme.css`. Regras principais: a cor de triagem sempre acompanha o nome escrito; o estado offline aparece na faixa amarela e preta; alergias sempre em destaque vermelho.
