BEGIN;

CREATE OR REPLACE FUNCTION scoring.guard_revision_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'borrador' AND NEW.status = 'evaluando') OR
    (OLD.status = 'evaluando' AND NEW.status IN ('evaluada', 'revision_manual', 'error')) OR
    (OLD.status = 'error' AND NEW.status = 'evaluando')
  ) THEN
    RAISE EXCEPTION 'invalid revision transition from % to %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'evaluando' THEN
    PERFORM scoring.assert_alternative_data_complete(NEW.id);
  END IF;
  RETURN NEW;
END $$;

COMMIT;
