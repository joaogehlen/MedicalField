#!/usr/bin/env bash
# MedicalField — comandos do dia a dia com Docker.
# Uso: ./mf.sh <comando>      (./mf.sh ajuda lista todos)
set -euo pipefail
cd "$(dirname "$0")"

AZUL=$'\e[1;34m'; VERDE=$'\e[1;32m'; AMARELO=$'\e[1;33m'; VERMELHO=$'\e[1;31m'; FIM=$'\e[0m'
titulo() { echo; echo "${AZUL}▶ $*${FIM}"; }
ok() { echo "${VERDE}✔ $*${FIM}"; }
aviso() { echo "${AMARELO}! $*${FIM}"; }
erro() { echo "${VERMELHO}✘ $*${FIM}" >&2; exit 1; }

# docker com sudo quando o usuário ainda não está no grupo "docker"
docker() { if command docker info >/dev/null 2>&1; then command docker "$@"; else sudo docker "$@"; fi; }
compose() { docker compose "$@"; }

porta() { grep -E '^PORTA=' .env 2>/dev/null | cut -d= -f2 || true; }
endereco() {
  local ip; ip="$(grep -E '^ENDERECO=' .env 2>/dev/null | cut -d= -f2 || true)"
  [[ -n "$ip" ]] || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  local p; p="$(porta)"; p="${p:-80}"
  if [[ "$p" == "80" ]]; then echo "http://${ip:-localhost}"; else echo "http://${ip:-localhost}:$p"; fi
}

criar_env() {
  [[ -f .env ]] && return
  gerar() { openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  cat > .env <<ENV
# Gerado por ./mf.sh na primeira subida. Não envie este arquivo para o GitHub.
PORTA=80
# IP público da VM (só para mostrar os links)
ENDERECO=${MF_ENDERECO:-}
PG_SUPERUSER_PASSWORD=$(gerar)
PW_IDENTITY=$(gerar)
PW_CLINICAL=$(gerar)
PW_DOCUMENT=$(gerar)
SENHA_DEMO=medicalfield

# E-mail: por padrão vai para a caixa de demonstração (http://<vm>/email/).
# Para envio real (ex.: Gmail com senha de app), preencha e rode ./mf.sh subir de novo:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=seu-email@gmail.com
# SMTP_PASSWORD=senha-de-app
# SMTP_STARTTLS=true
# SMTP_FROM=MedicalField <seu-email@gmail.com>
ENV
  chmod 600 .env
  ok "arquivo .env criado com senhas aleatórias"
}

aguardar() {
  local p; p="$(porta)"; p="${p:-80}"
  echo -n "  aguardando os serviços responderem"
  for _ in $(seq 1 120); do
    if curl -sf -o /dev/null "http://127.0.0.1:$p/app/" \
      && [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$p/api/profissional")" == "401" ]] \
      && [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$p/api/medicamento")" == "401" ]] \
      && [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$p/api/ficha/00000000-0000-0000-0000-000000000000/pdf")" == "401" ]]; then
      echo " ok"; return 0
    fi
    echo -n "."; sleep 2
  done
  echo; compose ps; erro "algum serviço não respondeu. Veja: ./mf.sh logs <serviço>"
}

enderecos() {
  local base; base="$(endereco)"
  echo
  echo "  Cliente (socorrista)   $base/app/        CRM 12345 / RS · senha medicalfield"
  echo "  Portal (central)       $base/portal/     Socorrista 0001 · senha medicalfield"
  echo "  Caixa de e-mails       $base/email/"
  echo "  API (Postman)          $base/api"
  echo
}

cmd="${1:-ajuda}"; shift || true
case "$cmd" in
  instalar-docker)
    titulo "Instalando o Docker"
    if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then ok "Docker já instalado"; exit 0; fi
    sudo apt-get update -q
    sudo apt-get install -y -q docker.io docker-compose-v2 curl openssl \
      || { aviso "pacotes do Ubuntu indisponíveis; usando o instalador oficial"; curl -fsSL https://get.docker.com | sudo sh; }
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER" || true
    # Compilar Java e Node precisa de memória: com menos de 3 GB de RAM e sem swap, cria 2 GB de swap.
    if [[ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 3000 ]] && [[ -z "$(swapon --show 2>/dev/null)" ]]; then
      sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
      grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
      ok "2 GB de swap criados (pouca memória RAM)"
    fi
    ok "Docker instalado ($(docker --version))"
    aviso "Saia e entre de novo no SSH para usar o docker sem sudo (opcional)."
    ;;

  subir)
    titulo "Subindo o MedicalField"
    criar_env
    compose up -d --build --remove-orphans
    aguardar
    ok "MedicalField no ar"
    enderecos
    ;;

  parar)
    titulo "Parando os containers (os dados ficam guardados)"
    compose down
    ok "parado"
    ;;

  reiniciar)
    compose restart "$@"
    aguardar; enderecos
    ;;

  zerar)
    titulo "Zerando o banco (volta aos dados de demonstração)"
    compose down -v
    compose up -d
    aguardar
    ok "banco zerado com os dados de demonstração"
    enderecos
    ;;

  status)
    compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
    ;;

  logs)
    compose logs -f --tail=100 "$@"
    ;;

  enderecos)
    enderecos
    ;;

  passo9)
    titulo "Passo 9 do roteiro: inserindo medicamentos direto no banco"
    compose exec -T postgres psql -U postgres -d medicalfield -f /medicalfield/roteiro/passo-09-novos-medicamentos.sql
    ok "inseridos — no cliente, use Sincronizar → Receber"
    ;;

  banco)
    titulo "psql no banco medicalfield (\\q para sair)"
    compose exec postgres psql -U postgres -d medicalfield
    ;;

  acessos)
    servico="${1:-clinical}"
    [[ "$servico" =~ ^(identity|clinical|document)$ ]] || erro "use: ./mf.sh acessos identity|clinical|document"
    titulo "Log de acesso do $servico-service (últimas 15 requisições)"
    compose exec -T postgres psql -U postgres -d medicalfield -c \
      "SELECT to_char(data_hora AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI:SS') AS data_hora, ip_cliente, profissional_id, metodo, rota, status_code, tempo_ms
       FROM $servico.access_log ORDER BY id DESC LIMIT 15;"
    ;;

  atualizar)
    titulo "Baixando a versão nova do GitHub e subindo de novo"
    git pull --ff-only
    "$0" subir
    ;;

  ajuda|*)
    cat <<AJUDA
MedicalField — comandos (rode dentro da pasta do projeto)

  ./mf.sh instalar-docker   instala o Docker (só na primeira vez)
  ./mf.sh subir             constrói e sobe todos os containers
  ./mf.sh status            lista os containers e o estado de cada um
  ./mf.sh enderecos         mostra os links do cliente, portal, e-mails e API
  ./mf.sh logs [serviço]    acompanha os logs (identity, clinical, document, gateway, postgres)
  ./mf.sh passo9            passo 9 do roteiro: insere medicamentos direto no banco
  ./mf.sh acessos [serviço] últimas linhas do log de acesso (identity, clinical, document)
  ./mf.sh banco             abre o psql no banco
  ./mf.sh zerar             apaga os dados e volta à demonstração inicial
  ./mf.sh parar             para tudo (os dados ficam guardados)
  ./mf.sh atualizar         git pull + subir
AJUDA
    ;;
esac
