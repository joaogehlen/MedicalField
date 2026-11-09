# 04 — APIs (Entregável E2, parte 1)

Coleção pronta para Postman/Insomnia: [`postman/MedicalField.postman_collection.json`](../postman/MedicalField.postman_collection.json). A requisição de login guarda o token na variável `token` automaticamente.

## 1. Convenções

| Item | Padrão |
|---|---|
| URL base | `http://<vm>/api` (local: `http://localhost:8080/api`). O Nginx remove `/api` e repassa ao serviço. |
| Autenticação | `Authorization: Bearer <accessToken>` em **todas** as rotas, exceto `POST /auth/login` e `POST /auth/refresh`. |
| Idempotência | Escritas aceitam `Idempotency-Key: <uuid>`. Reenvio → mesma resposta + `Idempotent-Replayed: true`. |
| Correlação | `X-Request-Id` (gerado pelo Nginx) volta na resposta e vai para o log de acesso. |
| Relógio do aparelho | `X-Client-Time` (opcional), usado na auditoria de conflitos. |
| Datas | ISO-8601 UTC. IDs: UUID (v7 quando gerados no aparelho). |
| Paginação | `?pagina=1&tamanho=50` → `{ "itens": [], "pagina": 1, "tamanho": 50, "total": 134 }` |

### Erros (RFC 7807)

```json
{
  "type": "https://medicalfield/erros/regra-clinica",
  "title": "Regra de segurança clínica",
  "status": 422,
  "detail": "Paciente com alergia registrada a \"Dipirona\". Dipirona Sódica pode causar reação alérgica.",
  "codigo": "REGRA_CLINICA",
  "requestId": "8f1c2a…",
  "alertas": [{ "codigo": "ALERGIA", "severidade": "BLOQUEANTE", "ignoravel": true, "mensagem": "…" }]
}
```

| Status | `codigo` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | corpo malformado, `Idempotency-Key` não-UUID |
| 401 | `NAO_AUTENTICADO` / `CREDENCIAIS_INVALIDAS` | token ausente/expirado; login errado |
| 403 | `SEM_PERMISSAO` | papel sem acesso |
| 404 | `NAO_ENCONTRADO` | recurso ou rota inexistente |
| 409 | `DEPENDENCIA_AUSENTE` / `CPF_DUPLICADO` | pai ainda não sincronizado; CPF de outra pessoa |
| 422 | `VALIDACAO` (com `campos`) / `REGRA_CLINICA` (com `alertas`) | validação; segurança clínica |
| 423 | `USUARIO_BLOQUEADO` | 5 senhas erradas (15 min) |
| 502 | `CLINICO_INDISPONIVEL` / `FALHA_ENVIO_EMAIL` | dependência fora do ar; SMTP recusou |

## 2. identity-service — Java · Spring Boot (`:8081`)

| Método | Rota | Papel | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | Autentica e devolve tokens |
| POST | `/auth/refresh` | refresh token | Renova (rotação) |
| POST | `/auth/logout` | autenticado | Revoga o refresh token |
| GET | `/auth/me` | autenticado | Profissional do token |
| GET | `/profissional` | ADMIN | Cadastro de apoio (`?tipoRegistro=&ativo=&busca=`) |
| GET | `/profissional/resumo?ids=a,b` | autenticado | Nome e registro (para fichas e listagens) |
| POST | `/log` | autenticado | Logs gerados no aparelho (idempotente) |
| GET | `/log` | ADMIN | Consulta (`?profissionalId=&dispositivoId=&acao=`) |
| GET | `/access-log` | ADMIN | Log de acesso deste serviço |

```json
// POST /auth/login
{ "tipoRegistro": "CRM", "numeroRegistro": "12345", "uf": "RS", "senha": "medicalfield" }
// 200
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9…",
  "expiresIn": 900,
  "refreshToken": "rt_P1l…",
  "profissional": { "id": "7a1f0000-0000-4000-8000-000000000002", "nome": "Dra. Ana Souza", "tipoRegistro": "CRM",
                    "numeroRegistro": "12345", "uf": "RS", "papel": "MEDICO", "email": "ana.souza@medicalfield.local", "ativo": true }
}
```

```json
// POST /log   (Idempotency-Key: 0193…)
{ "dispositivoId": "dev-bcb2aa616296",
  "logs": [{ "id": "0193…", "dataHora": "2026-11-20T13:41:02Z", "nivel": "WARN", "profissionalId": "7a1f…0002",
             "acao": "ALERTA_CLINICO_EXIBIDO", "entidade": "ATENDIMENTO", "entidadeId": "0193…",
             "detalhes": { "offline": true, "codigo": "ALERGIA", "medicamento": "Dipirona Sódica" } }] }
// 201
{ "recebidos": 1, "duplicados": 0 }
```

Ações: `LOGIN_ONLINE`, `LOGIN_OFFLINE`, `REDE_ALTERADA`, `PESSOA_CRIADA`, `PESSOA_ALTERADA`, `PRONTUARIO_CRIADO`, `PRONTUARIO_ALTERADO`, `ATENDIMENTO_CRIADO`, `ATENDIMENTO_ALTERADO`, `ATENDIMENTO_FINALIZADO`, `ALERTA_CLINICO_EXIBIDO`, `ALERTA_CLINICO_IGNORADO`, `SINCRONIZACAO_CONCLUIDA`, `ERRO_SINCRONIZACAO`.

## 3. clinical-service — TypeScript · NestJS (`:3001`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/medicamento` | Medicamentos ativos (`?incluirInativos=true`) |
| GET | `/medicamento/{id}` | Detalhe |
| GET | `/apoio/hospital`, `/apoio/viatura` | Cadastros de apoio |
| GET | `/pessoa` | Pessoas (paginado, `?busca=` nome ou CPF) |
| GET | `/pessoa/{id}` | Detalhe |
| POST | `/pessoa` | **Upsert idempotente** (201 criado · 200 atualizado/mesclado) |
| GET | `/prontuario` | Todos os prontuários (paginado, `?busca=`, `?pessoaId=`) com resumo da pessoa |
| GET | `/prontuario/{id}` | Prontuário com resumo da pessoa |
| POST | `/prontuario` | Upsert idempotente |
| GET | `/atendimento` | Todos (paginado; `?busca=&classificacao=&status=&de=&ate=&profissionalId=&pessoaId=`) |
| GET | `/atendimento/{pessoaId}` | **Atendimentos de uma pessoa** (rota da proposta) |
| GET | `/atendimento/detalhe/{id}` | Atendimento completo com pessoa, prontuário, viatura, hospital e catálogo |
| POST | `/atendimento` | Upsert idempotente + revalidação da `ClinicalSafetyChain` |
| POST | `/atendimento/{id}/adendo` | Adendo a um atendimento (o original é imutável) |
| GET | `/sync/pull?cursor=&limite=` | Mudanças desde o cursor |
| GET | `/sync/conflito` | Conflitos resolvidos (ADMIN) |
| GET | `/clinico/access-log` | Log de acesso deste serviço (ADMIN) |

Resposta de toda escrita: `{ "resultado": "CRIADO" | "ATUALIZADO" | "MESCLADO" | "MESCLADO_EM", "registro": {…}, "idCanonico"?: "…" }`.

```json
// POST /pessoa   (Idempotency-Key: 0193…)
{
  "id": "0193a1c1-6f0b-7d3e-9a52-3f0c1e2d4b5a",
  "nome": "Carlos Eduardo Ramos", "identificada": true, "cpf": "390.533.447-05",
  "dataNascimento": "1991-03-14", "sexo": "M",
  "contatoNome": "Ana Ramos", "contatoParentesco": "Irmã", "contatoTelefone": "(51) 99555-0303",
  "contatoEmail": "ana.ramos@exemplo.com.br",
  "baseVersion": null, "atualizadoEmCliente": "2026-11-20T13:40:00Z",
  "registradoPor": "7a1f0000-0000-4000-8000-000000000002", "dispositivoId": "dev-bcb2aa616296", "criadoOffline": true
}
```
Vítima não identificada: `identificada: false`, `nome: "Desconhecido"` e `caracteristicas` obrigatório.

```json
// POST /prontuario
{ "id": "0193…", "pessoaId": "0193a1c1-…", "tipoSanguineo": "B+", "alergias": ["Dipirona"],
  "comorbidades": [], "medicamentosUsoContinuo": [], "observacoes": null,
  "baseVersion": null, "atualizadoEmCliente": "…", "registradoPor": "…", "dispositivoId": "…" }
```

```json
// POST /atendimento
{
  "id": "0193…", "pessoaId": "0193a1c1-…", "prontuarioId": "0193…",
  "viaturaId": "3c1a0000-0000-4000-8000-000000000001", "hospitalDestinoId": null,
  "status": "FINALIZADO", "iniciadoEm": "2026-11-20T13:35:00Z", "finalizadoEm": "2026-11-20T14:10:00Z",
  "local": { "descricao": "BR-386, km 343 — Estrela", "latitude": null, "longitude": null },
  "queixaPrincipal": "Queda de moto, trauma em membro superior direito", "descricao": null,
  "triagem": { "protocolo": "MANCHESTER", "classificacao": "LARANJA" },
  "glasgow": { "ocular": 4, "verbal": 5, "motora": 6, "total": 15 },
  "sinaisVitais": [{ "id": "0193…", "aferidoEm": "2026-11-20T13:38:00Z", "paSistolica": 142, "paDiastolica": 90, "fc": 112, "spo2": 95 }],
  "medicamentos": [{ "id": "0193…", "medicamentoId": "…", "dose": 100, "unidade": "mg", "via": "IV",
                     "administradoEm": "2026-11-20T13:45:00Z", "administradoPor": "7a1f…0002", "alertasIgnorados": [] }],
  "procedimentos": ["Imobilização de membro"],
  "baseVersion": null, "atualizadoEmCliente": "…", "registradoPor": "…", "dispositivoId": "…", "criadoOffline": true
}
```

Validações (schemas zod de `packages/shared`, os mesmos do aparelho): Glasgow O 1–4, V 1–5, M 1–6 e total = soma; classificação válida no protocolo (START: vermelho/amarelo/verde/preto; Manchester: vermelho/laranja/amarelo/verde/azul); faixas fisiológicas de sinais vitais; PA sistólica > diastólica; atendimento finalizado exige `finalizadoEm` ≥ `iniciadoEm`; CPF com dígitos verificadores. Regras clínicas: ver [03 §6](03-sincronizacao-offline.md#6-regras-de-segurança-clínica-sem-rede).

## 4. document-service — Python · FastAPI (`:8000`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/ficha/{atendimentoId}/pdf` | PDF (`Content-Disposition: attachment`, cabeçalho `X-Documento-Sha256`) |
| POST | `/ficha/{atendimentoId}/email` | Envia a ficha anexa (idempotente) |
| GET | `/ficha/{atendimentoId}/envios` | Histórico de envios |
| GET | `/ficha/{atendimentoId}/documentos` | Versões geradas com SHA-256 |
| GET | `/ficha/access-log` | Log de acesso deste serviço (ADMIN) |

```json
// POST /ficha/0193…/email   (Idempotency-Key: 0193…)
{ "destinatarios": [{ "email": "ana.ramos@exemplo.com.br", "nome": "Ana Ramos", "tipo": "FAMILIAR" }],
  "mensagem": "Segue a ficha do atendimento." }
// 200
{ "envios": [{ "id": "…", "status": "ENVIADO", "messageId": "<…@medicalfield>", "destinatarioEmail": "ana.ramos@exemplo.com.br",
               "tipo": "FAMILIAR", "enviadoEm": "2026-11-20T14:20:05Z" }],
  "sha256": "f1e4dbaa32cf…" }
```
`tipo` ∈ `PACIENTE`, `FAMILIAR`, `HOSPITAL`. Conteúdo da ficha: cabeçalho com número e etiqueta de triagem, paciente, **alergias em destaque**, ocorrência, Glasgow, sinais vitais, medicamentos com profissional e justificativas de alerta, procedimentos, adendos, selo “registrado offline”, responsável e aviso LGPD.

## 5. Roteamento no gateway

| Prefixo público | Serviço |
|---|---|
| `/api/auth/*`, `/api/profissional*`, `/api/log`, `/api/access-log` | identity `:8081` |
| `/api/ficha/*` | document `:8000` |
| demais `/api/*` | clinical `:3001` |
| `/app/*`, `/portal/*` | arquivos estáticos (builds) |

As rotas `/docs` (Swagger) do identity e do document escutam só em `127.0.0.1` e **não** são expostas pelo Nginx.
