CREATE SCHEMA IF NOT EXISTS terms AUTHORIZATION terms_migrator;

COMMENT ON SCHEMA terms IS 'Independent terms and conditions bounded context';

CREATE TYPE terms.version_state AS ENUM (
  'DRAFT', 'SCHEDULED', 'EFFECTIVE', 'SUPERSEDED', 'WITHDRAWN'
);
CREATE TYPE terms.content_format AS ENUM ('markdown');
CREATE TYPE terms.audit_outcome AS ENUM ('succeeded', 'denied', 'failed');
CREATE TYPE terms.idempotency_operation AS ENUM (
  'accept', 'create_version', 'schedule', 'withdraw'
);
