#!/usr/bin/env bash
# Gera a configuração do Nginx a partir do template.
#   render-nginx.sh <porta> <pasta-www> <arquivo-saida>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
sed -e "s|\${MF_PORT}|$1|g" -e "s|\${MF_WWW}|$2|g" "$ROOT/infra/nginx/medicalfield.conf.template" > "$3"
