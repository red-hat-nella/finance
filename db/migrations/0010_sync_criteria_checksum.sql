BEGIN;

DROP TRIGGER IF EXISTS criteria_immutable ON scoring.criteria_versions;
UPDATE scoring.criteria_versions
   SET checksum=decode('b1e1f281dbe194430c53cd18ce85400ee217999a92e83a27ace2d1101c4e8eff','hex')
 WHERE version='SCORING-MVP-1.0.0';

CREATE OR REPLACE FUNCTION scoring.protect_criteria() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.weights IS DISTINCT FROM OLD.weights OR NEW.rules IS DISTINCT FROM OLD.rules OR NEW.bands IS DISTINCT FROM OLD.bands OR NEW.checksum IS DISTINCT FROM OLD.checksum OR NEW.rounding_mode IS DISTINCT FROM OLD.rounding_mode THEN RAISE EXCEPTION 'criteria rules are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER criteria_immutable
  BEFORE UPDATE ON scoring.criteria_versions
  FOR EACH ROW EXECUTE FUNCTION scoring.protect_criteria();

CREATE OR REPLACE FUNCTION scoring.guard_revision_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF NOT ((OLD.status='borrador' AND NEW.status='evaluando') OR (OLD.status='evaluando' AND NEW.status IN ('evaluada','revision_manual','error'))) THEN RAISE EXCEPTION 'invalid revision transition from % to %',OLD.status,NEW.status; END IF;
 IF NEW.status='evaluando' THEN PERFORM scoring.assert_alternative_data_complete(NEW.id); END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS revision_transition_guard ON scoring.application_revisions;
CREATE TRIGGER revision_transition_guard
  BEFORE UPDATE OF status ON scoring.application_revisions
  FOR EACH ROW EXECUTE FUNCTION scoring.guard_revision_transition();

COMMIT;
