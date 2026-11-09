#!/usr/bin/env bash
# Apaga os dados dos três schemas e recria tudo na próxima subida (dados de demonstração).
# Use antes de ensaiar o roteiro de testes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
"$ROOT/infra/scripts/stop-all.sh" > /dev/null 2>&1 || true
PG_PORT="${MF_PG_PORT:-$(pg_lsclusters --no-header 2>/dev/null | awk '$4=="online" {print $3; exit}')}"
PG_PORT="${PG_PORT:-5432}"
SQL="DROP SCHEMA IF EXISTS identity CASCADE; DROP SCHEMA IF EXISTS clinical CASCADE; DROP SCHEMA IF EXISTS document CASCADE;"
if [[ "$(id -u)" == "0" ]]; then su postgres -c "PGOPTIONS='-c client_min_messages=warning' psql -p $PG_PORT -q -d medicalfield -c \"$SQL\""; else PGOPTIONS="-c client_min_messages=warning" psql -p "$PG_PORT" -q -d medicalfield -c "$SQL"; fi
rm -f "$ROOT"/.runtime/fichas/* "$ROOT"/.runtime/mail/* 2>/dev/null || true
"$ROOT/infra/scripts/setup-dev.sh" > /dev/null
echo "Banco zerado. Rode infra/scripts/start-all.sh para subir com os dados de demonstração."
