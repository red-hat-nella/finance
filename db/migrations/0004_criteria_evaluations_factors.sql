BEGIN;
CREATE TABLE scoring.criteria_versions (
 version varchar(64) PRIMARY KEY, status varchar(16) NOT NULL CHECK(status IN ('active','retired')),
 algorithm_name varchar(64) NOT NULL, input_schema_version varchar(32) NOT NULL,
 weights jsonb NOT NULL, rules jsonb NOT NULL, bands jsonb NOT NULL, rounding_mode varchar(32) NOT NULL,
 checksum bytea NOT NULL CHECK(octet_length(checksum)=32), effective_from timestamptz NOT NULL,
 retired_at timestamptz, created_by varchar(128) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_criteria_active ON scoring.criteria_versions((status)) WHERE status='active';
CREATE TABLE scoring.evaluations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_id uuid UNIQUE DEFAULT gen_random_uuid(),
 revision_id uuid REFERENCES scoring.application_revisions(id) ON DELETE SET NULL, attempt_number integer NOT NULL CHECK(attempt_number>0),
 retry_of_evaluation_id uuid REFERENCES scoring.evaluations(id), org_scope_id varchar(128), owner_actor_id varchar(128), initiated_by_actor_id varchar(128),
 document_blind_index bytea, document_masked varchar(24), applicant_display_name varchar(64),
 status varchar(24) NOT NULL CHECK(status IN ('evaluando','evaluada','revision_manual','error')),
 score smallint CHECK(score BETWEEN 300 AND 850), risk_band varchar(24) CHECK(risk_band IN ('riesgo_bajo','riesgo_medio','riesgo_alto')),
 recommendation_code varchar(80), recommendation_text varchar(240), manual_review_reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(manual_review_reasons)='array'),
 criteria_version varchar(64) NOT NULL REFERENCES scoring.criteria_versions(version), input_hash bytea NOT NULL CHECK(octet_length(input_hash)=32),
 correlation_id uuid NOT NULL, error_code varchar(64), started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 retention_until timestamptz, anonymized_at timestamptz,
 UNIQUE(revision_id,attempt_number),
 CONSTRAINT ck_evaluation_result CHECK (
  (status='evaluando' AND score IS NULL AND risk_band IS NULL AND recommendation_code IS NULL AND error_code IS NULL AND completed_at IS NULL) OR
  (status='evaluada' AND score IS NOT NULL AND risk_band IN ('riesgo_bajo','riesgo_alto') AND recommendation_code IS NOT NULL AND error_code IS NULL AND completed_at IS NOT NULL AND retention_until IS NOT NULL) OR
  (status='revision_manual' AND ((score BETWEEN 550 AND 699 AND risk_band='riesgo_medio') OR (score IS NULL AND risk_band IS NULL AND jsonb_array_length(manual_review_reasons)>0)) AND error_code IS NULL AND completed_at IS NOT NULL AND retention_until IS NOT NULL) OR
  (status='error' AND score IS NULL AND risk_band IS NULL AND recommendation_code IS NULL AND error_code IS NOT NULL AND completed_at IS NOT NULL AND retention_until IS NOT NULL)
 )
);
ALTER TABLE scoring.applications ADD CONSTRAINT fk_application_evaluation FOREIGN KEY(current_evaluation_id) REFERENCES scoring.evaluations(id) DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX uq_evaluation_active ON scoring.evaluations(revision_id) WHERE status='evaluando';
CREATE INDEX ix_evaluation_owner_history ON scoring.evaluations(org_scope_id,owner_actor_id,completed_at DESC,id DESC) WHERE anonymized_at IS NULL;
CREATE INDEX ix_evaluation_org_history ON scoring.evaluations(org_scope_id,completed_at DESC,id DESC);
CREATE INDEX ix_evaluation_status ON scoring.evaluations(org_scope_id,status,completed_at DESC);
CREATE INDEX ix_evaluation_document ON scoring.evaluations(org_scope_id,document_blind_index,completed_at DESC);
CREATE INDEX ix_evaluation_retention ON scoring.evaluations(retention_until) WHERE anonymized_at IS NULL;
CREATE TABLE scoring.evaluation_input_snapshots (
 evaluation_id uuid PRIMARY KEY REFERENCES scoring.evaluations(id) ON DELETE CASCADE,
 schema_version varchar(32) NOT NULL, normalized_input jsonb NOT NULL CHECK(jsonb_typeof(normalized_input)='object'), input_hash bytea NOT NULL CHECK(octet_length(input_hash)=32)
);
CREATE TABLE scoring.evaluation_factors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), evaluation_id uuid NOT NULL REFERENCES scoring.evaluations(id) ON DELETE CASCADE,
 ordinal smallint NOT NULL CHECK(ordinal BETWEEN 1 AND 3), dimension varchar(16) NOT NULL CHECK(dimension IN ('utility','mobile','income')),
 rule_code varchar(64) NOT NULL, direction varchar(16) NOT NULL CHECK(direction IN ('favorable','unfavorable','neutral')),
 contribution_points numeric(6,2) NOT NULL, explanation varchar(240) NOT NULL, UNIQUE(evaluation_id,ordinal), UNIQUE(evaluation_id,dimension)
);
COMMIT;
