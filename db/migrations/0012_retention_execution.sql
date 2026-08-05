BEGIN;

ALTER TABLE scoring.retention_runs
  ADD COLUMN IF NOT EXISTS consents_deleted integer NOT NULL DEFAULT 0 CHECK (consents_deleted >= 0),
  ADD COLUMN IF NOT EXISTS audit_events_anonymized integer NOT NULL DEFAULT 0 CHECK (audit_events_anonymized >= 0);

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'scoring_retention') THEN
    CREATE ROLE scoring_retention NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA scoring TO scoring_retention;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA scoring TO scoring_retention;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA scoring TO scoring_retention;

CREATE OR REPLACE FUNCTION scoring.retention_context_enabled() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('scoring.retention_mode', true) = 'on'
     AND (
       pg_has_role(session_user, 'scoring_retention', 'member')
       OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = session_user AND rolsuper)
     )
$$;

CREATE OR REPLACE FUNCTION scoring.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF scoring.retention_context_enabled() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

CREATE OR REPLACE FUNCTION scoring.protect_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE locked timestamptz;
BEGIN
  IF scoring.retention_context_enabled() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT locked_at INTO locked
    FROM scoring.application_revisions
   WHERE id = COALESCE(NEW.revision_id, OLD.revision_id);
  IF locked IS NOT NULL THEN
    RAISE EXCEPTION 'snapshot belongs to a locked revision';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

COMMIT;
