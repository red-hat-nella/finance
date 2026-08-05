\set ON_ERROR_STOP on

SELECT 'CREATE ROLE scoring_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoring_app')\gexec
ALTER ROLE scoring_app PASSWORD :'application_password';

SELECT 'CREATE ROLE scoring_retention NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoring_retention')\gexec
SELECT 'CREATE ROLE scoring_retention_job LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE scoring_retention'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoring_retention_job')\gexec
ALTER ROLE scoring_retention_job PASSWORD :'retention_password';

GRANT CONNECT ON DATABASE alternative_scoring TO scoring_app, scoring_retention_job;
