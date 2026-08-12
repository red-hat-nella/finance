CREATE TABLE terms.terms_idempotency_records (
  record_id uuid PRIMARY KEY,
  actor_id varchar(128) NOT NULL,
  org_scope_id varchar(128) NOT NULL,
  operation terms.idempotency_operation NOT NULL,
  idempotency_key uuid NOT NULL,
  request_sha256 char(64) NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  response_status integer NOT NULL CHECK (response_status BETWEEN 200 AND 599),
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  UNIQUE (actor_id, org_scope_id, operation, idempotency_key)
);

CREATE INDEX ix_terms_idempotency_expiry
  ON terms.terms_idempotency_records (expires_at);

REVOKE ALL ON SCHEMA terms FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA terms FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA terms FROM PUBLIC;

GRANT USAGE ON SCHEMA terms TO terms_app, terms_retention, terms_backup;
GRANT SELECT, INSERT, UPDATE ON terms.terms_versions TO terms_app;
GRANT SELECT, INSERT ON terms.terms_acceptances TO terms_app;
GRANT SELECT, INSERT ON terms.terms_audit_events TO terms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON terms.terms_idempotency_records TO terms_app;

GRANT SELECT (acceptance_id, retention_until, anonymized_at)
  ON terms.terms_acceptances TO terms_retention;
GRANT UPDATE (actor_id, org_scope_id, actor_fingerprint, anonymized_at)
  ON terms.terms_acceptances TO terms_retention;
GRANT INSERT ON terms.terms_audit_events TO terms_retention;

GRANT SELECT ON ALL TABLES IN SCHEMA terms TO terms_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE terms_migrator IN SCHEMA terms
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE terms_migrator IN SCHEMA terms
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;
