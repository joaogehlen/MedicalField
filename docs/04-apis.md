# 04 — APIs (Entregável E2, parte 1)

Coleção pronta para Postman/Insomnia: [`postman/MedicalField.postman_collection.json`](../postman/MedicalField.postman_collection.json). A requisição de login guarda o token na variável `token` automaticamente.

## 1. Convenções

| Item | Padrão |
|---|---|
| URL base | `http://<vm>/api` (local: `http://localhost:8080/api`). O Nginx remove `/api` e repassa ao serviço. |
| Autenticação | `Authorization: Bearer <accessToken>` em **todas** as rotas, exceto `POST /auth/login`. |
| Idempotência | `POST /pessoa`, `/prontuario`, `/atendimento` aceitam `Idempotency-Key: <uuid>`. Reenvio → mesma resposta, sem gravar de novo. |
| Datas e IDs | ISO-8601. IDs: UUID (v7 quando gerados no aparelho). |
| Paginação | `?pagina=1&tamanho=50` → `{ "itens": [], "pagina": 1, "tamanho": 50, "total": 4 }` |

### Erros (RFC 7807)

```json
{
  "title": "Regra de segurança clínica",
  "status": 422,
  "detail": "Paciente alérgico a Dipirona: Dipirona não pode ser administrado.",
  "codigo": "REGRA_CLINICA",
  "alertas": ["Paciente alérgico a Dipirona: Dipirona não pode ser administrado."]
}
```

| Status | `codigo` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | corpo malformado, `Idempotency-Key` não-UUID |
| 401 | `NAO_AUTENTICADO` / `CREDENCIAIS_INVALIDAS` | token ausente ou expirado; login errado |
| 403 | `SEM_PERMISSAO` | papel sem acesso |
| 404 | `NAO_ENCONTRADO` | recurso inexistente |
| 409 | `DEPENDENCIA_AUSENTE` / `CPF_DUPLICADO` | pessoa ou prontuário ainda não enviado; CPF de outra pessoa |
| 422 | `VALIDACAO` (com `campos`) / `REGRA_CLINICA` (com `alertas`) | validação; segurança clínica |
| 502 | `CLINICO_INDISPONIVEL` / `FALHA_ENVIO_EMAIL` | serviço clínico fora do ar; SMTP recusou |

## 2. identity-service — Java · Spring Boot (`:8081`)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | Login (público) |
| GET | `/profissional` | Profissionais cadastrados |
| POST | `/log` | Logs gerados no aparelho (idempotente pelo `id` de cada log) |

```json
// POST /auth/login
{ "tipoRegistro": "CRM", "numeroRegistro": "12345", "uf": "RS", "senha": "medicalfield" }
// 200
{ "accessToken": "eyJhbGciOiJSUzI1NiJ9…", "expiresIn": 43200,
  "profissional": { "id": "7a1f0000-0000-4000-8000-000000000002", "nome": "Dra. Ana Souza",
                    "tipoRegistro": "CRM", "numeroRegistro": "12345", "uf": "RS", "papel": "MEDICO", "ativo": true } }
```

```json
// POST /log
{ "dispositivoId": "dev-bcb2aa616296",
  "logs": [{ "id": "0193…", "dataHora": "2026-11-20T13:40:00Z", "profissionalId": "7a1f…0002",
             "acao": "PESSOA_CRIADO", "detalhes": { "id": "0193…" } }] }
// 201
{ "recebidos": 1, "duplicados": 0 }
```

## 3. clinical-service — TypeScript · NestJS (`:3001`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/medicamento` | Catálogo de medicamentos |
| POST | `/pessoa` | Cria ou atualiza pessoa (vítima) |
| GET | `/prontuario` | Prontuários com a pessoa (paginado, `?busca=` por nome ou CPF) |
| GET | `/prontuario/{id}` | Prontuário com a pessoa e a lista de atendimentos |
| POST | `/prontuario` | Cria ou atualiza prontuário |
| GET | `/atendimento` | Atendimentos (paginado, `?busca=`) |
| GET | `/atendimento/{pessoaId}` | Atendimentos de uma pessoa |
| GET | `/atendimento/detalhe/{id}` | Atendimento completo, com pessoa, prontuário e medicamentos |
| POST | `/atendimento` | Registra atendimento |
| GET | `/sync/pull?cursor={n}` | Mudanças desde o cursor (usado pelo aparelho) |

Resposta de toda escrita: `{ "resultado": "CRIADO" | "ATUALIZADO" | "MESCLADO", "registro": {…} }`.

```json
// POST /pessoa   (Idempotency-Key: 0193…)
{
  "id": "0193a1c1-6f0b-7d3e-9a52-3f0c1e2d4b5a",
  "nome": "Carlos Eduardo Ramos", "cpf": "39053344705", "dataNascimento": "1991-03-14", "sexo": "M",
  "telefone": null, "email": null, "contatoNome": "Ana Ramos", "contatoEmail": "ana.ramos@exemplo.com.br",
  "baseVersion": null, "atualizadoEmCliente": "2026-11-20T13:40:00Z",
  "registradoPor": "7a1f0000-0000-4000-8000-000000000002", "dispositivoId": "dev-bcb2aa616296", "criadoOffline": true
}
```

```json
// POST /prontuario
{ "id": "0193…", "pessoaId": "0193a1c1-…", "tipoSanguineo": "B+", "alergias": ["Dipirona"],
  "comorbidades": [], "observacoes": null,
  "baseVersion": null, "atualizadoEmCliente": "…", "registradoPor": "…", "dispositivoId": "…" }
```

```json
// POST /atendimento
{
  "id": "0193…", "pessoaId": "0193a1c1-…", "prontuarioId": "0193…",
  "dataHora": "2026-11-20T13:35:00Z", "local": "BR-386, km 343 — Estrela",
  "queixaPrincipal": "Queda de moto, trauma em membro superior direito", "observacoes": null,
  "triagem": { "protocolo": "MANCHESTER", "classificacao": "LARANJA" },
  "glasgow": { "ocular": 4, "verbal": 5, "motora": 6, "total": 15 },
  "sinaisVitais": { "paSistolica": 142, "paDiastolica": 90, "fc": 112, "fr": null, "spo2": 95, "temperatura": null, "glicemia": null },
  "medicamentos": [{ "id": "0193…", "medicamentoId": "…", "dose": 100, "via": "IV", "horario": "2026-11-20T13:45:00Z" }],
  "profissionalNome": "Dra. Ana Souza · CRM 12345/RS",
  "baseVersion": null, "atualizadoEmCliente": "…", "registradoPor": "…", "dispositivoId": "…", "criadoOffline": true
}
```

Validações (schemas zod de `packages/shared`, os mesmos do aparelho): Glasgow O 1–4, V 1–5, M 1–6 e total = soma; classificação válida no protocolo (START: vermelho/amarelo/verde/preto; Manchester: vermelho/laranja/amarelo/verde/azul); faixas dos sinais vitais; CPF com dígitos verificadores. Regras clínicas: ver [03 §6](03-sincronizacao-offline.md#6-regras-de-segurança-clínica-sem-rede).

## 4. document-service — Python · FastAPI (`:8000`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/ficha/{atendimentoId}/pdf` | Ficha de atendimento em PDF |
| POST | `/ficha/{atendimentoId}/email` | Envia a ficha em anexo por e-mail |

```json
// POST /ficha/0193…/email
{ "email": "ana.ramos@exemplo.com.br", "nome": "Ana Ramos" }
// 200
{ "enviadoPara": "ana.ramos@exemplo.com.br", "messageId": "<…@medicalfield>" }
```

Conteúdo da ficha: cabeçalho com a classificação de risco, paciente, **alergias em destaque**, ocorrência, Glasgow, sinais vitais, medicamentos, observações e profissional responsável.

## 5. Roteamento no gateway

| Prefixo público | Serviço |
|---|---|
| `/api/auth/*`, `/api/profissional`, `/api/log` | identity `:8081` |
| `/api/ficha/*` | document `:8000` |
| demais `/api/*` | clinical `:3001` |
| `/app/*`, `/portal/*` | telas (arquivos estáticos) |
