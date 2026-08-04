BEGIN;
CREATE TABLE scoring.audit_events (
 id bigserial PRIMARY KEY, event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT now(),
 org_scope_id varchar(128), actor_id varchar(128), actor_roles varchar(64)[] NOT NULL DEFAULT '{}', event_type varchar(80) NOT NULL,
 application_id uuid, evaluation_id uuid, correlation_id uuid NOT NULL, outcome varchar(24) NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object')
);
CREATE INDEX ix_audit_evaluation_time ON scoring.audit_events(evaluation_id,occurred_at,id);
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON scoring.audit_events FOR EACH ROW EXECUTE FUNCTION scoring.reject_mutation();
CREATE TABLE scoring.idempotency_records (
 org_scope_id varchar(128) NOT NULL, actor_id varchar(128) NOT NULL, operation varchar(80) NOT NULL, idempotency_key uuid NOT NULL,
 request_hash bytea NOT NULL CHECK(octet_length(request_hash)=32), state varchar(16) NOT NULL CHECK(state IN ('in_progress','completed','failed')),
 response_status smallint, response_headers jsonb, response_body jsonb, resource_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(org_scope_id,actor_id,operation,idempotency_key)
);
CREATE INDEX ix_idempotency_expiry ON scoring.idempotency_records(expires_at);
CREATE TABLE scoring.retention_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 initiated_by varchar(128) NOT NULL, draft_deleted integer NOT NULL DEFAULT 0, evaluations_anonymized integer NOT NULL DEFAULT 0,
 status varchar(16) NOT NULL CHECK(status IN ('running','completed','failed')), error_code varchar(64)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='scoring_app') THEN CREATE ROLE scoring_app NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='scoring_migrator') THEN CREATE ROLE scoring_migrator NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA scoring TO scoring_app;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA scoring TO scoring_app;
REVOKE UPDATE,DELETE ON scoring.audit_events FROM scoring_app;
COMMIT;

