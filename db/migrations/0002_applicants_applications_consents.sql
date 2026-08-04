BEGIN;
CREATE TABLE scoring.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_scope_id varchar(128) NOT NULL,
  document_type varchar(16) NOT NULL CHECK (document_type IN ('CC','CE','PASSPORT','PPT')),
  document_blind_index bytea NOT NULL CHECK (octet_length(document_blind_index)=32),
  document_ciphertext bytea NOT NULL,
  document_nonce bytea NOT NULL CHECK (octet_length(document_nonce)=12),
  document_tag bytea NOT NULL CHECK (octet_length(document_tag)=16),
  document_masked varchar(24) NOT NULL,
  full_name_ciphertext bytea NOT NULL,
  full_name_nonce bytea NOT NULL CHECK (octet_length(full_name_nonce)=12),
  full_name_tag bytea NOT NULL CHECK (octet_length(full_name_tag)=16),
  display_name varchar(64) NOT NULL,
  phone_ciphertext bytea, phone_nonce bytea, phone_tag bytea,
  email_ciphertext bytea, email_nonce bytea, email_tag bytea,
  pii_key_version smallint NOT NULL CHECK (pii_key_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  CONSTRAINT ck_applicant_phone_bundle CHECK ((phone_ciphertext IS NULL AND phone_nonce IS NULL AND phone_tag IS NULL) OR (phone_ciphertext IS NOT NULL AND octet_length(phone_nonce)=12 AND octet_length(phone_tag)=16)),
  CONSTRAINT ck_applicant_email_bundle CHECK ((email_ciphertext IS NULL AND email_nonce IS NULL AND email_tag IS NULL) OR (email_ciphertext IS NOT NULL AND octet_length(email_nonce)=12 AND octet_length(email_tag)=16)),
  CONSTRAINT ck_applicant_contact CHECK (phone_ciphertext IS NOT NULL OR email_ciphertext IS NOT NULL)
);
CREATE UNIQUE INDEX uq_applicant_document_active ON scoring.applicants(org_scope_id, document_type, document_blind_index) WHERE deleted_at IS NULL;

CREATE TABLE scoring.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_id uuid UNIQUE DEFAULT gen_random_uuid(),
  org_scope_id varchar(128) NOT NULL, owner_actor_id varchar(128) NOT NULL,
  applicant_id uuid REFERENCES scoring.applicants(id) ON DELETE SET NULL,
  current_revision_id uuid, current_evaluation_id uuid,
  current_status varchar(24) NOT NULL DEFAULT 'borrador' CHECK (current_status IN ('borrador','evaluando','evaluada','revision_manual','error')),
  revision_count integer NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  draft_expires_at timestamptz, deleted_at timestamptz,
  CONSTRAINT ck_application_draft_expiry CHECK ((current_status='borrador')=(draft_expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_application_active_draft ON scoring.applications(org_scope_id,owner_actor_id,applicant_id) WHERE current_status='borrador' AND deleted_at IS NULL;
CREATE INDEX ix_application_owner_status ON scoring.applications(org_scope_id,owner_actor_id,current_status,updated_at DESC);

CREATE TABLE scoring.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES scoring.applications(id),
  status varchar(16) NOT NULL CHECK (status IN ('accepted','denied','revoked')),
  notice_version varchar(64) NOT NULL, purpose_code varchar(64) NOT NULL CHECK (purpose_code='ALTERNATIVE_CREDIT_RISK_EVALUATION'),
  recorded_by_actor_id varchar(128) NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  revoked_by_actor_id varchar(128), revoked_at timestamptz, retention_until timestamptz, deleted_at timestamptz,
  CONSTRAINT ck_consent_revocation CHECK ((status='revoked')=(revoked_by_actor_id IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE INDEX ix_consent_application_time ON scoring.consents(application_id,recorded_at DESC);

CREATE TABLE scoring.application_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES scoring.applications(id),
  revision_number integer NOT NULL CHECK (revision_number>0), previous_revision_id uuid REFERENCES scoring.application_revisions(id),
  consent_id uuid REFERENCES scoring.consents(id), status varchar(24) NOT NULL CHECK (status IN ('borrador','evaluando','evaluada','revision_manual','error')),
  lock_version integer NOT NULL DEFAULT 1 CHECK (lock_version>0), input_hash bytea,
  created_by_actor_id varchar(128) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, draft_expires_at timestamptz,
  UNIQUE(application_id,revision_number),
  CONSTRAINT ck_revision_lock CHECK ((status='borrador' AND locked_at IS NULL AND input_hash IS NULL) OR (status<>'borrador' AND locked_at IS NOT NULL AND octet_length(input_hash)=32))
);
CREATE UNIQUE INDEX uq_revision_open_draft ON scoring.application_revisions(application_id) WHERE status='borrador';
ALTER TABLE scoring.applications ADD CONSTRAINT fk_application_revision FOREIGN KEY(current_revision_id) REFERENCES scoring.application_revisions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE scoring.revision_identity_snapshots (
  revision_id uuid PRIMARY KEY REFERENCES scoring.application_revisions(id) ON DELETE CASCADE,
  document_type varchar(16) NOT NULL, document_blind_index bytea NOT NULL CHECK(octet_length(document_blind_index)=32),
  document_ciphertext bytea NOT NULL, document_nonce bytea NOT NULL CHECK(octet_length(document_nonce)=12), document_tag bytea NOT NULL CHECK(octet_length(document_tag)=16),
  document_masked varchar(24) NOT NULL, full_name_ciphertext bytea NOT NULL,
  full_name_nonce bytea NOT NULL CHECK(octet_length(full_name_nonce)=12), full_name_tag bytea NOT NULL CHECK(octet_length(full_name_tag)=16),
  display_name varchar(64) NOT NULL, phone_ciphertext bytea, phone_nonce bytea, phone_tag bytea,
  email_ciphertext bytea, email_nonce bytea, email_tag bytea, pii_key_version smallint NOT NULL CHECK(pii_key_version>0)
);
COMMIT;

