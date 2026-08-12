CREATE TABLE terms.terms_versions (
  version_id uuid PRIMARY KEY,
  version_code varchar(64) NOT NULL UNIQUE
    CHECK (version_code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  title varchar(200) NOT NULL CHECK (title = btrim(title) AND length(title) > 0),
  content_format terms.content_format NOT NULL DEFAULT 'markdown',
  content_source text NOT NULL
    CHECK (octet_length(content_source) BETWEEN 1 AND 524288),
  content_sha256 char(64) NOT NULL UNIQUE
    CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  state terms.version_state NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  created_by_actor_id varchar(128) NOT NULL,
  scheduled_at timestamptz,
  effective_at timestamptz,
  published_at timestamptz,
  published_by_actor_id varchar(128),
  superseded_at timestamptz,
  withdrawn_at timestamptz,
  request_id uuid NOT NULL,
  CHECK ((state <> 'SCHEDULED') OR (scheduled_at IS NOT NULL AND effective_at IS NOT NULL)),
  CHECK ((state NOT IN ('EFFECTIVE', 'SUPERSEDED')) OR
    (effective_at IS NOT NULL AND published_at IS NOT NULL AND published_by_actor_id IS NOT NULL)),
  CHECK ((state <> 'SUPERSEDED') OR superseded_at IS NOT NULL),
  CHECK ((state <> 'WITHDRAWN') OR withdrawn_at IS NOT NULL)
);

CREATE UNIQUE INDEX uq_terms_versions_single_effective
  ON terms.terms_versions ((state)) WHERE state = 'EFFECTIVE';
CREATE INDEX ix_terms_versions_effective_at
  ON terms.terms_versions (effective_at DESC) WHERE state IN ('SCHEDULED', 'EFFECTIVE');

CREATE FUNCTION terms.prevent_published_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('SCHEDULED', 'EFFECTIVE', 'SUPERSEDED') AND (
    NEW.version_code IS DISTINCT FROM OLD.version_code OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.content_format IS DISTINCT FROM OLD.content_format OR
    NEW.content_source IS DISTINCT FROM OLD.content_source OR
    NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
  ) THEN
    RAISE EXCEPTION 'published terms content is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_terms_versions_published_immutable
BEFORE UPDATE ON terms.terms_versions
FOR EACH ROW EXECUTE FUNCTION terms.prevent_published_version_mutation();
