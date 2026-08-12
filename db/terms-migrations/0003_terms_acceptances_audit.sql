CREATE TABLE terms.terms_acceptances (
  acceptance_id uuid PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES terms.terms_versions(version_id),
  actor_id varchar(128),
  org_scope_id varchar(128),
  actor_fingerprint char(64) CHECK (actor_fingerprint IS NULL OR actor_fingerprint ~ '^[a-f0-9]{64}$'),
  accepted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  request_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  retention_until timestamptz NOT NULL,
  anonymized_at timestamptz,
  CHECK (
    (anonymized_at IS NULL AND actor_id IS NOT NULL AND org_scope_id IS NOT NULL AND actor_fingerprint IS NOT NULL)
    OR
    (anonymized_at IS NOT NULL AND actor_id IS NULL AND org_scope_id IS NULL AND actor_fingerprint IS NULL)
  )
);

CREATE UNIQUE INDEX uq_terms_acceptance_actor_version
  ON terms.terms_acceptances (org_scope_id, actor_id, version_id)
  WHERE anonymized_at IS NULL;
CREATE INDEX ix_terms_acceptance_scope_time
  ON terms.terms_acceptances (org_scope_id, accepted_at DESC, acceptance_id)
  WHERE anonymized_at IS NULL;
CREATE INDEX ix_terms_acceptance_retention
  ON terms.terms_acceptances (retention_until, acceptance_id)
  WHERE anonymized_at IS NULL;

CREATE TABLE terms.terms_audit_events (
  event_id uuid PRIMARY KEY,
  event_type varchar(32) NOT NULL CHECK (event_type IN (
    'created', 'scheduled', 'effective', 'superseded', 'withdrawn',
    'accepted', 'denied', 'retention'
  )),
  actor_id varchar(128),
  org_scope_id varchar(128),
  actor_role varchar(32) CHECK (actor_role IS NULL OR actor_role IN (
    'credit_analyst', 'supervisor', 'auditor', 'terms_admin', 'system'
  )),
  version_id uuid REFERENCES terms.terms_versions(version_id),
  acceptance_id uuid REFERENCES terms.terms_acceptances(acceptance_id),
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  request_id uuid NOT NULL,
  outcome terms.audit_outcome NOT NULL,
  error_code varchar(80),
  retention_until timestamptz
);

CREATE INDEX ix_terms_audit_scope_time
  ON terms.terms_audit_events (org_scope_id, occurred_at DESC, event_id);

CREATE FUNCTION terms.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'terms audit events are append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER trg_terms_audit_no_update_or_delete
BEFORE UPDATE OR DELETE ON terms.terms_audit_events
FOR EACH ROW EXECUTE FUNCTION terms.reject_audit_mutation();

CREATE FUNCTION terms.protect_acceptance_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'terms acceptances cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF current_user <> 'terms_retention' AND NEW IS NOT DISTINCT FROM OLD THEN
    RETURN OLD;
  END IF;
  IF current_user <> 'terms_retention' THEN
    RAISE EXCEPTION 'terms acceptances are append-only' USING ERRCODE = '42501';
  END IF;
  IF NEW.acceptance_id IS DISTINCT FROM OLD.acceptance_id OR
     NEW.version_id IS DISTINCT FROM OLD.version_id OR
     NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR
     NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR
     NEW.request_id IS DISTINCT FROM OLD.request_id OR
     NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
     NEW.retention_until IS DISTINCT FROM OLD.retention_until OR
     NEW.actor_id IS NOT NULL OR NEW.org_scope_id IS NOT NULL OR
     NEW.actor_fingerprint IS NOT NULL OR NEW.anonymized_at IS NULL THEN
    RAISE EXCEPTION 'retention may only anonymize acceptance identity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_terms_acceptance_protect_evidence
BEFORE UPDATE OR DELETE ON terms.terms_acceptances
FOR EACH ROW EXECUTE FUNCTION terms.protect_acceptance_evidence();
