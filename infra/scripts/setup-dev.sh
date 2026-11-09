#!/usr/bin/env bash
# Prepara o ambiente local de desenvolvimento/demonstração:
#  - garante o PostgreSQL no ar e cria banco, usuários e schemas
#  - gera o par de chaves do JWT (RS256)
#  - escreve os arquivos de ambiente de cada serviço em .runtime/env
# Idempotente: pode ser executado várias vezes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.runtime"
mkdir -p "$RUNTIME"/{env,keys,logs,fichas,mail}

# --- PostgreSQL --------------------------------------------------------------
# Debian/Ubuntu/WSL: sobe o primeiro cluster existente (qualquer versão), se estiver parado.
if command -v pg_lsclusters >/dev/null 2>&1; then
  if ! pg_lsclusters --no-header | awk '$4=="online"' | grep -q .; then
    read -r PG_VER PG_NOME _ < <(pg_lsclusters --no-header | head -1) || true
    if [[ -z "${PG_VER:-}" ]]; then
      echo "Nenhum cluster PostgreSQL encontrado. Instale com: sudo apt install postgresql" >&2
      exit 1
    fi
    pg_ctlcluster "$PG_VER" "$PG_NOME" start
  fi
fi

# Porta real do PostgreSQL local. Não assume 5432: se outro PostgreSQL (por exemplo o
# instalado no Windows) já ocupa a 5432, o do Ubuntu sobe em outra porta (5433…).
PG_PORT="${MF_PG_PORT:-}"
if [[ -z "$PG_PORT" ]] && command -v pg_lsclusters >/dev/null 2>&1; then
  PG_PORT="$(pg_lsclusters --no-header | awk '$4=="online" {print $3; exit}')"
fi
PG_PORT="${PG_PORT:-5432}"

SECRETS="$RUNTIME/env/db-passwords"
if [[ ! -f "$SECRETS" ]]; then
  {
    echo "PW_IDENTITY=$(openssl rand -hex 16)"
    echo "PW_CLINICAL=$(openssl rand -hex 16)"
    echo "PW_DOCUMENT=$(openssl rand -hex 16)"
  } > "$SECRETS"
  chmod 600 "$SECRETS"
fi
# shellcheck disable=SC1090
source "$SECRETS"

run_psql() {
  if [[ "$(id -u)" == "0" ]]; then
    su postgres -c "PGOPTIONS='-c client_min_messages=warning' psql -p $PG_PORT -v ON_ERROR_STOP=1 -q -v pw_identity=$PW_IDENTITY -v pw_clinical=$PW_CLINICAL -v pw_document=$PW_DOCUMENT -f -" < "$1"
  else
    PGOPTIONS='-c client_min_messages=warning' psql -p "$PG_PORT" -v ON_ERROR_STOP=1 -q -v pw_identity="$PW_IDENTITY" -v pw_clinical="$PW_CLINICAL" -v pw_document="$PW_DOCUMENT" -f "$1"
  fi
}
run_psql "$ROOT/infra/db/init.sql"

# Confere se os serviços vão conseguir entrar pela rede (como o Java/Node/Python fazem).
if ! PGPASSWORD="$PW_IDENTITY" psql -h 127.0.0.1 -p "$PG_PORT" -U mf_identity -d medicalfield -tAc 'select 1' >/dev/null 2>&1; then
  cat >&2 <<MSG

✘ O banco foi preparado, mas o login de rede em 127.0.0.1:$PG_PORT falhou.
  Isso acontece quando OUTRO PostgreSQL responde nessa porta — normalmente um
  PostgreSQL instalado no próprio Windows.

  Clusters do Ubuntu (versão, nome, porta, estado):
$(pg_lsclusters --no-header 2>/dev/null | sed 's/^/    /')

  Soluções:
   1) Pare o PostgreSQL do Windows: Win+R → services.msc → "postgresql-x64-…" → Parar.
      Depois rode de novo: sudo infra/scripts/start-all.sh
   2) Ou force a porta do PostgreSQL do Ubuntu: sudo MF_PG_PORT=5433 infra/scripts/start-all.sh
MSG
  exit 1
fi
echo "✔ banco medicalfield, usuários e schemas prontos (PostgreSQL na porta $PG_PORT)"

# --- Chaves JWT ---------------------------------------------------------------
if [[ ! -f "$RUNTIME/keys/jwt-private.pem" ]]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$RUNTIME/keys/jwt-private.pem" 2>/dev/null
  openssl rsa -in "$RUNTIME/keys/jwt-private.pem" -pubout -out "$RUNTIME/keys/jwt-public.pem" 2>/dev/null
  chmod 600 "$RUNTIME/keys/jwt-private.pem"
fi
echo "✔ chaves JWT em .runtime/keys"

# --- Arquivos de ambiente -----------------------------------------------------
cat > "$RUNTIME/env/identity.env" <<ENV
SERVER_PORT=8081
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:$PG_PORT/medicalfield?currentSchema=identity
SPRING_DATASOURCE_USERNAME=mf_identity
SPRING_DATASOURCE_PASSWORD=$PW_IDENTITY
JWT_PRIVATE_KEY_PATH=$RUNTIME/keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=$RUNTIME/keys/jwt-public.pem
MEDICALFIELD_SEED_SENHA=${MEDICALFIELD_SEED_SENHA:-medicalfield}
ENV

cat > "$RUNTIME/env/clinical.env" <<ENV
PORT=3001
DATABASE_URL=postgresql://mf_clinical:$PW_CLINICAL@127.0.0.1:$PG_PORT/medicalfield
JWT_PUBLIC_KEY_PATH=$RUNTIME/keys/jwt-public.pem
ENV

cat > "$RUNTIME/env/document.env" <<ENV
PORT=8000
DATABASE_URL=postgresql+psycopg://mf_document:$PW_DOCUMENT@127.0.0.1:$PG_PORT/medicalfield
JWT_PUBLIC_KEY_PATH=$RUNTIME/keys/jwt-public.pem
CLINICAL_BASE_URL=http://127.0.0.1:3001
IDENTITY_BASE_URL=http://127.0.0.1:8081
FICHAS_DIR=$RUNTIME/fichas
# Sem SMTP_HOST os e-mails são gravados como .eml em MAIL_OUTBOX_DIR.
# Para envio real (Gmail com senha de app, Brevo...), defina SMTP_* em .runtime/env/smtp.env
MAIL_OUTBOX_DIR=$RUNTIME/mail
SMTP_FROM="MedicalField <nao-responda@medicalfield.local>"
ENV
if [[ -f "$RUNTIME/env/smtp.env" ]]; then cat "$RUNTIME/env/smtp.env" >> "$RUNTIME/env/document.env"; fi
chmod 600 "$RUNTIME"/env/*.env
echo "✔ variáveis de ambiente em .runtime/env"
