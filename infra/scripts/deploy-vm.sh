#!/usr/bin/env bash
# Implantação na VM da Univates (Ubuntu), sem contêineres. Executar como root a partir
# do clone do repositório:  sudo infra/scripts/deploy-vm.sh
# Idempotente: na primeira vez cria usuário, banco, chaves e variáveis; nas seguintes
# só recompila, copia e reinicia.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OPT=/opt/medicalfield
ETC=/etc/medicalfield
WWW=/var/www/medicalfield
VAR=/var/lib/medicalfield

echo "• usuário e pastas"
id medicalfield >/dev/null 2>&1 || useradd --system --home "$OPT" --shell /usr/sbin/nologin medicalfield
mkdir -p "$OPT" "$ETC" "$WWW" "$VAR"/mail
chown -R medicalfield: "$VAR"

echo "• banco, usuários e schemas"
if [[ ! -f "$ETC/db-passwords" ]]; then
  printf 'PW_IDENTITY=%s\nPW_CLINICAL=%s\nPW_DOCUMENT=%s\n' "$(openssl rand -hex 16)" "$(openssl rand -hex 16)" "$(openssl rand -hex 16)" > "$ETC/db-passwords"
  chmod 600 "$ETC/db-passwords"
fi
source "$ETC/db-passwords"
su postgres -c "PGOPTIONS='-c client_min_messages=warning' psql -q -v ON_ERROR_STOP=1 -v pw_identity=$PW_IDENTITY -v pw_clinical=$PW_CLINICAL -v pw_document=$PW_DOCUMENT -f -" < "$ROOT/infra/db/init.sql"

echo "• chaves JWT"
if [[ ! -f "$ETC/jwt-private.pem" ]]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$ETC/jwt-private.pem" 2>/dev/null
  openssl rsa -in "$ETC/jwt-private.pem" -pubout -out "$ETC/jwt-public.pem" 2>/dev/null
fi
chown medicalfield: "$ETC"/jwt-*.pem && chmod 600 "$ETC/jwt-private.pem" && chmod 644 "$ETC/jwt-public.pem"

echo "• variáveis de ambiente"
[[ -f "$ETC/identity.env" ]] || cat > "$ETC/identity.env" <<ENV
SERVER_PORT=8081
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/medicalfield?currentSchema=identity
SPRING_DATASOURCE_USERNAME=mf_identity
SPRING_DATASOURCE_PASSWORD=$PW_IDENTITY
JWT_PRIVATE_KEY_PATH=$ETC/jwt-private.pem
JWT_PUBLIC_KEY_PATH=$ETC/jwt-public.pem
MEDICALFIELD_SEED_SENHA=medicalfield
ENV
[[ -f "$ETC/clinical.env" ]] || cat > "$ETC/clinical.env" <<ENV
PORT=3001
DATABASE_URL=postgresql://mf_clinical:$PW_CLINICAL@127.0.0.1:5432/medicalfield
JWT_PUBLIC_KEY_PATH=$ETC/jwt-public.pem
SEED_DEMO=true
ENV
[[ -f "$ETC/document.env" ]] || cat > "$ETC/document.env" <<ENV
PORT=8000
DATABASE_URL=postgresql+psycopg://mf_document:$PW_DOCUMENT@127.0.0.1:5432/medicalfield
JWT_PUBLIC_KEY_PATH=$ETC/jwt-public.pem
CLINICAL_BASE_URL=http://127.0.0.1:3001
MAIL_OUTBOX_DIR=$VAR/mail
SMTP_FROM="MedicalField <nao-responda@medicalfield.local>"
# Para envio real, descomente e preencha (ex.: Gmail com senha de app):
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASSWORD=...
ENV
chmod 600 "$ETC"/*.env && chown medicalfield: "$ETC"/*.env

echo "• build"
cd "$ROOT"
npm ci --no-audit --no-fund
npm run build
(cd services/identity-service && mvn -q -B -DskipTests package)

echo "• cópia dos artefatos"
install -d "$OPT"/{identity-service,clinical-service,document-service}
install -m 644 services/identity-service/target/identity-service.jar "$OPT/identity-service/"
rsync -a --delete services/clinical-service/{dist,migrations,seeds,package.json} "$OPT/clinical-service/"
# -L: os pacotes do workspace (@medicalfield/shared) são links simbólicos
rsync -aL --delete node_modules "$OPT/clinical-service/"
rsync -a --delete --exclude .venv --exclude tests services/document-service/ "$OPT/document-service/"
[[ -x "$OPT/document-service/.venv/bin/uvicorn" ]] || python3 -m venv "$OPT/document-service/.venv"
"$OPT/document-service/.venv/bin/pip" install -q -r "$OPT/document-service/requirements.txt"
rsync -a --delete apps/client/dist/ "$WWW/app/"
rsync -a --delete apps/portal/dist/ "$WWW/portal/"
chown -R medicalfield: "$OPT"

echo "• systemd e nginx"
cp infra/systemd/medicalfield-*.service /etc/systemd/system/
"$ROOT/infra/scripts/render-nginx.sh" 80 "$WWW" /etc/nginx/sites-available/medicalfield
ln -sfn /etc/nginx/sites-available/medicalfield /etc/nginx/sites-enabled/medicalfield
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now medicalfield-identity medicalfield-clinical medicalfield-document
systemctl restart medicalfield-identity medicalfield-clinical medicalfield-document
systemctl reload nginx

echo "✔ MedicalField implantado: http://$(hostname -I | awk '{print $1}')/portal/  e  /app/"
