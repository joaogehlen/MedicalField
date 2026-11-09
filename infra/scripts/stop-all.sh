#!/usr/bin/env bash
# Derruba os serviços e o Nginx iniciados por start-all.sh e espera cada processo
# terminar de verdade (o Java leva alguns segundos e seguraria a porta na próxima subida).
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.runtime"
[[ -f "$RUNTIME/nginx/nginx.pid" ]] && nginx -c "$RUNTIME/nginx/nginx.conf" -p "$RUNTIME/nginx" -s stop 2>/dev/null
for nome in identity clinical document; do
  arquivo="$RUNTIME/$nome.pid"
  [[ -f "$arquivo" ]] || continue
  pid="$(cat "$arquivo")"
  if kill "$pid" 2>/dev/null; then
    for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$arquivo"
done
echo "MedicalField parado."
