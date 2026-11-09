#!/usr/bin/env bash
# Roteiro de testes — passo 9: insere novos medicamentos direto no banco (psql),
# usando a mesma conexão do clinical-service (.runtime/env/clinical.env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
URL="$(grep '^DATABASE_URL=' "$ROOT/.runtime/env/clinical.env" | cut -d= -f2-)"
psql "$URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/infra/db/roteiro/passo-09-novos-medicamentos.sql"
