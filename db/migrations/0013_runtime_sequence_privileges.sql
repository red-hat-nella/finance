BEGIN;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA scoring TO scoring_app;
GRANT DELETE ON
  scoring.utility_references,
  scoring.income_details,
  scoring.mobile_details,
  scoring.alternative_data_sets
TO scoring_app;
REVOKE UPDATE, DELETE ON scoring.audit_events FROM scoring_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA scoring
  GRANT SELECT, INSERT, UPDATE ON TABLES TO scoring_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA scoring TO scoring_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA scoring
  GRANT USAGE, SELECT ON SEQUENCES TO scoring_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA scoring TO scoring_retention;
ALTER DEFAULT PRIVILEGES IN SCHEMA scoring
  GRANT USAGE, SELECT ON SEQUENCES TO scoring_retention;

COMMIT;
