BEGIN;
CREATE OR REPLACE FUNCTION scoring.protect_locked_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.locked_at IS NOT NULL AND (NEW.input_hash IS DISTINCT FROM OLD.input_hash OR NEW.consent_id IS DISTINCT FROM OLD.consent_id) THEN
  RAISE EXCEPTION 'locked revision is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER revision_lock_guard BEFORE UPDATE ON scoring.application_revisions FOR EACH ROW EXECUTE FUNCTION scoring.protect_locked_revision();
CREATE OR REPLACE FUNCTION scoring.protect_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE locked timestamptz;
BEGIN
 SELECT locked_at INTO locked FROM scoring.application_revisions WHERE id=COALESCE(NEW.revision_id,OLD.revision_id);
 IF locked IS NOT NULL THEN RAISE EXCEPTION 'snapshot belongs to a locked revision'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER identity_snapshot_guard BEFORE UPDATE OR DELETE ON scoring.revision_identity_snapshots FOR EACH ROW EXECUTE FUNCTION scoring.protect_snapshot();
CREATE TRIGGER alternatives_guard BEFORE UPDATE OR DELETE ON scoring.alternative_data_sets FOR EACH ROW EXECUTE FUNCTION scoring.protect_snapshot();
CREATE TRIGGER income_guard BEFORE UPDATE OR DELETE ON scoring.income_details FOR EACH ROW EXECUTE FUNCTION scoring.protect_snapshot();
CREATE TRIGGER utility_guard BEFORE UPDATE OR DELETE ON scoring.utility_references FOR EACH ROW EXECUTE FUNCTION scoring.protect_snapshot();
CREATE TRIGGER mobile_guard BEFORE UPDATE OR DELETE ON scoring.mobile_details FOR EACH ROW EXECUTE FUNCTION scoring.protect_snapshot();
CREATE TRIGGER evaluation_snapshot_no_update BEFORE UPDATE OR DELETE ON scoring.evaluation_input_snapshots FOR EACH ROW EXECUTE FUNCTION scoring.reject_mutation();
CREATE TRIGGER evaluation_factor_no_update BEFORE UPDATE OR DELETE ON scoring.evaluation_factors FOR EACH ROW EXECUTE FUNCTION scoring.reject_mutation();
CREATE OR REPLACE FUNCTION scoring.guard_revision_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF NOT ((OLD.status='borrador' AND NEW.status='evaluando') OR (OLD.status='evaluando' AND NEW.status IN ('evaluada','revision_manual','error'))) THEN RAISE EXCEPTION 'invalid revision transition from % to %',OLD.status,NEW.status; END IF;
 IF NEW.status='evaluando' THEN PERFORM scoring.assert_alternative_data_complete(NEW.id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER revision_transition_guard BEFORE UPDATE OF status ON scoring.application_revisions FOR EACH ROW EXECUTE FUNCTION scoring.guard_revision_transition();
CREATE OR REPLACE FUNCTION scoring.protect_criteria() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.weights IS DISTINCT FROM OLD.weights OR NEW.rules IS DISTINCT FROM OLD.rules OR NEW.bands IS DISTINCT FROM OLD.bands OR NEW.checksum IS DISTINCT FROM OLD.checksum OR NEW.rounding_mode IS DISTINCT FROM OLD.rounding_mode THEN RAISE EXCEPTION 'criteria rules are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER criteria_immutable BEFORE UPDATE ON scoring.criteria_versions FOR EACH ROW EXECUTE FUNCTION scoring.protect_criteria();
COMMIT;
