\set ON_ERROR_STOP on

SELECT 'CREATE ROLE scoring_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoring_app')\gexec
ALTER ROLE scoring_app PASSWORD :'application_password';

SELECT 'CREATE ROLE scoring_retention NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoring_retention')\gexec
SELECT 'CREATE ROLE scoring_retention_job LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE scoring_retention'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scoring_retention_job')\gexec
ALTER ROLE scoring_retention_job PASSWORD :'retention_password';

SELECT 'CREATE ROLE terms_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'terms_app')\gexec
ALTER ROLE terms_app PASSWORD :'terms_runtime_password';

SELECT 'CREATE ROLE terms_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'terms_migrator')\gexec
ALTER ROLE terms_migrator PASSWORD :'terms_migrator_password';

SELECT 'CREATE ROLE terms_retention LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'terms_retention')\gexec
ALTER ROLE terms_retention PASSWORD :'terms_retention_password';

SELECT 'CREATE ROLE terms_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'terms_backup')\gexec
ALTER ROLE terms_backup PASSWORD :'terms_backup_password';

SELECT format('CREATE DATABASE %I OWNER terms_migrator', :'terms_database_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'terms_database_name')\gexec

GRANT CONNECT ON DATABASE alternative_scoring TO scoring_app, scoring_retention_job;
GRANT CONNECT ON DATABASE :"terms_database_name" TO terms_app, terms_migrator, terms_retention, terms_backup;
REVOKE CREATE, TEMPORARY ON DATABASE :"terms_database_name" FROM terms_app, terms_retention, terms_backup;
