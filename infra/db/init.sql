-- MedicalField — criação do banco, usuários e schemas (um por serviço).
-- Uso:  psql -v pw_identity=... -v pw_clinical=... -v pw_document=... -f init.sql
-- Executar como superusuário (postgres). Idempotente.

SELECT 'CREATE DATABASE medicalfield'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'medicalfield')\gexec

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mf_identity') THEN CREATE ROLE mf_identity LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mf_clinical') THEN CREATE ROLE mf_clinical LOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mf_document') THEN CREATE ROLE mf_document LOGIN; END IF;
END $$;

ALTER ROLE mf_identity PASSWORD :'pw_identity';
ALTER ROLE mf_clinical PASSWORD :'pw_clinical';
ALTER ROLE mf_document PASSWORD :'pw_document';

\connect medicalfield

REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS identity AUTHORIZATION mf_identity;
CREATE SCHEMA IF NOT EXISTS clinical AUTHORIZATION mf_clinical;
CREATE SCHEMA IF NOT EXISTS document AUTHORIZATION mf_document;

-- Cada serviço enxerga apenas o próprio schema (database-per-service lógico).
REVOKE ALL ON SCHEMA identity FROM mf_clinical, mf_document;
REVOKE ALL ON SCHEMA clinical FROM mf_identity, mf_document;
REVOKE ALL ON SCHEMA document FROM mf_identity, mf_clinical;

ALTER ROLE mf_identity SET search_path = identity;
ALTER ROLE mf_clinical SET search_path = clinical;
ALTER ROLE mf_document SET search_path = document;
