BEGIN;

ALTER TABLE scoring.alternative_data_sets
  ALTER COLUMN income_status DROP NOT NULL,
  ALTER COLUMN utilities_status DROP NOT NULL,
  ALTER COLUMN mobile_status DROP NOT NULL;

ALTER TABLE scoring.alternative_data_sets
  DROP CONSTRAINT ck_income_availability,
  DROP CONSTRAINT ck_utilities_availability,
  DROP CONSTRAINT ck_mobile_availability;

ALTER TABLE scoring.alternative_data_sets
  ADD CONSTRAINT ck_income_availability CHECK (
    (income_status IS NULL AND income_unavailable_reason IS NULL) OR
    (income_status = 'provided' AND income_unavailable_reason IS NULL) OR
    (income_status = 'unavailable' AND length(income_unavailable_reason) BETWEEN 10 AND 240)
  ),
  ADD CONSTRAINT ck_utilities_availability CHECK (
    (utilities_status IS NULL AND utilities_unavailable_reason IS NULL) OR
    (utilities_status = 'provided' AND utilities_unavailable_reason IS NULL) OR
    (utilities_status = 'unavailable' AND length(utilities_unavailable_reason) BETWEEN 10 AND 240)
  ),
  ADD CONSTRAINT ck_mobile_availability CHECK (
    (mobile_status IS NULL AND mobile_unavailable_reason IS NULL) OR
    (mobile_status = 'provided' AND mobile_unavailable_reason IS NULL) OR
    (mobile_status = 'unavailable' AND length(mobile_unavailable_reason) BETWEEN 10 AND 240)
  );

CREATE OR REPLACE FUNCTION scoring.assert_alternative_data_complete(target_revision uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE availability scoring.alternative_data_sets%ROWTYPE;
BEGIN
 SELECT * INTO STRICT availability FROM scoring.alternative_data_sets WHERE revision_id=target_revision;
 IF availability.income_status IS NULL OR availability.utilities_status IS NULL OR availability.mobile_status IS NULL THEN
  RAISE EXCEPTION 'all alternative-data dimensions must be declared before evaluation';
 END IF;
 IF (availability.income_status='provided') <> EXISTS(SELECT 1 FROM scoring.income_details WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'income availability and detail are inconsistent'; END IF;
 IF (availability.mobile_status='provided') <> EXISTS(SELECT 1 FROM scoring.mobile_details WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'mobile availability and detail are inconsistent'; END IF;
 IF availability.utilities_status='provided' AND NOT EXISTS(SELECT 1 FROM scoring.utility_references WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'provided utilities require at least one reference'; END IF;
 IF availability.utilities_status='unavailable' AND EXISTS(SELECT 1 FROM scoring.utility_references WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'unavailable utilities cannot have references'; END IF;
 IF (SELECT count(*) FROM scoring.utility_references WHERE revision_id=target_revision)>3 THEN RAISE EXCEPTION 'at most three utility references are allowed'; END IF;
END $$;

COMMIT;
