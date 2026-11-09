# 08 — Estrutura do Código e Desenvolvimento

## 1. Monorepo

```
MedicalField/
├── apps/
│   ├── client/                 # Campo (PWA) — React + Dexie
│   │   └── src/
│   │       ├── data/           # db.ts (IndexedDB) · repositories.ts (Repository local/remoto)
│   │       ├── sync/           # network.ts (Observer) · commands.ts (Command) · engine.ts (SyncEngine)
│   │       ├── services/       # registro.ts (grava local + Outbox) · logs.ts
│   │       ├── auth/           # sessão e login offline (PBKDF2)
│   │       ├── api/            # ApiClient (simulador, JWT, refresh, Idempotency-Key)
│   │       └── ui/             # casca, telas e componentes
│   └── portal/                 # Portal da regulação — React
├── packages/
│   ├── shared/                 # tipos, schemas zod, escalas, ClinicalSafetyChain (+ testes)
│   └── design/                 # tokens.css · base.css · components.css · fontes
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

## 4. Design (Impeccable)

As telas seguem a skill de design **Impeccable**: `PRODUCT.md` (produto e usuários), `.impeccable/surfaces/*.md` (contrato de direção de cada superfície) e `DESIGN.md` + `.impeccable/design.json` (sistema construído). Ao criar uma tela nova, reutilize as classes de `packages/design` e as regras de `DESIGN.md`. Em especial: a cor de triagem sempre acompanha o nome escrito, e o estado offline é mostrado pela faixa refletiva, não por toasts.
