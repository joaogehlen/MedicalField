#!/usr/bin/env bash
# Derruba os serviços e o Nginx iniciados por start-all.sh.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNTIME="$ROOT/.runtime"
[[ -f "$RUNTIME/nginx/nginx.pid" ]] && nginx -c "$RUNTIME/nginx/nginx.conf" -p "$RUNTIME/nginx" -s stop 2>/dev/null
for nome in identity clinical document; do
  if [[ -f "$RUNTIME/$nome.pid" ]]; then
    kill "$(cat "$RUNTIME/$nome.pid")" 2>/dev/null
    rm -f "$RUNTIME/$nome.pid"
  fi
done
echo "MedicalField parado."
