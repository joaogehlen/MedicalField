#!/usr/bin/env bash
# Sobe o MedicalField inteiro na máquina local (demonstração/desenvolvimento):
# PostgreSQL, os três serviços e o Nginx em http://localhost:${MF_PORT:-8080}.
# Pré-requisitos: Node 22, Java 21 + Maven, Python 3.12+, PostgreSQL 16, Nginx.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.runtime"
PORTA="${MF_PORT:-8080}"
cd "$ROOT"

"$ROOT/infra/scripts/setup-dev.sh" > /dev/null

if [[ "${MF_BUILD:-1}" == "1" ]]; then
  echo "• build (shared, clinical, cliente, portal)"
  npm install --no-audit --no-fund > /dev/null
  npm run build > "$RUNTIME/logs/build.log" 2>&1 || { tail -30 "$RUNTIME/logs/build.log"; exit 1; }
  echo "• build identity-service (Maven)"
  (cd services/identity-service && mvn -q -B -DskipTests package > "$RUNTIME/logs/mvn.log" 2>&1) || { tail -30 "$RUNTIME/logs/mvn.log"; exit 1; }
  if [[ ! -x services/document-service/.venv/bin/uvicorn ]]; then
    echo "• venv do document-service"
    python3 -m venv services/document-service/.venv
    services/document-service/.venv/bin/pip install -q -r services/document-service/requirements.txt
  fi
fi

"$ROOT/infra/scripts/stop-all.sh" > /dev/null 2>&1 || true

iniciar() { # nome env comando...
  local nome="$1" env="$2"; shift 2
  ( set -a; source "$RUNTIME/env/$env.env"; set +a; cd "$ROOT"; exec "$@" ) > "$RUNTIME/logs/$nome.log" 2>&1 &
  echo $! > "$RUNTIME/$nome.pid"
}

echo "• iniciando serviços"
iniciar identity identity java -Xmx384m -jar services/identity-service/target/identity-service.jar
iniciar clinical clinical node services/clinical-service/dist/main.js
iniciar document document bash -c "cd services/document-service && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000"

mkdir -p "$RUNTIME/www" "$RUNTIME/nginx"
ln -sfn "$ROOT/apps/client/dist" "$RUNTIME/www/app"
ln -sfn "$ROOT/apps/portal/dist" "$RUNTIME/www/portal"
"$ROOT/infra/scripts/render-nginx.sh" "$PORTA" "$RUNTIME/www" "$RUNTIME/nginx/medicalfield.conf"
cat > "$RUNTIME/nginx/nginx.conf" <<CONF
worker_processes 1;
pid $RUNTIME/nginx/nginx.pid;
error_log $RUNTIME/logs/nginx-error.log;
events { worker_connections 512; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log $RUNTIME/logs/nginx-access.log;
  client_body_temp_path $RUNTIME/nginx/tmp;
  proxy_temp_path $RUNTIME/nginx/tmp;
  include $RUNTIME/nginx/medicalfield.conf;
}
CONF
mkdir -p "$RUNTIME/nginx/tmp"
nginx -c "$RUNTIME/nginx/nginx.conf" -p "$RUNTIME/nginx"

echo -n "• aguardando serviços"
for i in $(seq 1 90); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORTA/app/" \
     && curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORTA/api/profissional" | grep -q 401 \
     && curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORTA/api/medicamento" | grep -q 401 \
     && curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORTA/api/ficha/00000000-0000-0000-0000-000000000000/pdf" | grep -q 401; then
    echo " ok"
    echo
    echo "  Cliente (socorrista):  http://localhost:$PORTA/app/"
    echo "  Portal (regulação):    http://localhost:$PORTA/portal/"
    echo "  API (Postman):         http://localhost:$PORTA/api"
    echo "  Logs:                  $RUNTIME/logs/"
    exit 0
  fi
  for nome in identity clinical document; do
    if ! kill -0 "$(cat "$RUNTIME/$nome.pid")" 2>/dev/null; then
      echo -n " ($nome-service encerrou)"; break 2
    fi
  done
  echo -n "."; sleep 1
done
echo " falhou."
echo
# Diagnóstico: qual serviço não respondeu e o final do log dele.
for svc in "identity:8081:/profissional" "clinical:3001:/medicamento" "document:8000:/ficha/00000000-0000-0000-0000-000000000000/pdf"; do
  IFS=: read -r nome porta rota <<< "$svc"
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$porta$rota" || true)
  if [[ "$codigo" == "401" ]]; then
    echo "  ✔ $nome-service no ar (porta $porta)"
  elif kill -0 "$(cat "$RUNTIME/$nome.pid" 2>/dev/null)" 2>/dev/null; then
    echo "  … $nome-service ainda iniciando (processo vivo, porta $porta sem resposta)"
  else
    echo "  ✘ $nome-service ENCERROU COM ERRO. Últimas linhas de .runtime/logs/$nome.log:"
    echo "  ------------------------------------------------------------------"
    tail -n 25 "$RUNTIME/logs/$nome.log" 2>/dev/null | sed 's/^/  │ /'
    echo "  ------------------------------------------------------------------"
  fi
done
exit 1
