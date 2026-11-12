#!/bin/sh
# Roda uma única vez, quando o volume do PostgreSQL é criado:
# cria o banco "medicalfield", um usuário e um schema para cada serviço (infra/db/init.sql).
set -e
psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d postgres \
  -v pw_identity="$PW_IDENTITY" \
  -v pw_clinical="$PW_CLINICAL" \
  -v pw_document="$PW_DOCUMENT" \
  -f /medicalfield/init.sql
echo "MedicalField: banco, usuários e schemas criados."
