BEGIN;

ALTER TABLE scoring.evaluation_factors
  ADD COLUMN dimension_index numeric(6,3),
  ADD COLUMN weight numeric(4,3),
  ADD COLUMN observed_summary varchar(240);

DROP TRIGGER evaluation_factor_no_update ON scoring.evaluation_factors;

UPDATE scoring.evaluation_factors
   SET weight = CASE WHEN dimension='utility' THEN 0.400 ELSE 0.300 END,
       dimension_index = contribution_points /
         (5.5 * CASE WHEN dimension='utility' THEN 0.400 ELSE 0.300 END),
       observed_summary = explanation;

CREATE TRIGGER evaluation_factor_no_update
  BEFORE UPDATE OR DELETE ON scoring.evaluation_factors
  FOR EACH ROW EXECUTE FUNCTION scoring.reject_mutation();

ALTER TABLE scoring.evaluation_factors
  ALTER COLUMN dimension_index SET NOT NULL,
  ALTER COLUMN weight SET NOT NULL,
  ALTER COLUMN observed_summary SET NOT NULL,
  ADD CONSTRAINT ck_factor_dimension_index CHECK(dimension_index BETWEEN 0 AND 100),
  ADD CONSTRAINT ck_factor_weight CHECK(weight IN (0.300,0.400));

COMMIT;
