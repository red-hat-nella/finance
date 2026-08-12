CREATE FUNCTION terms.anonymize_expired_acceptances(
  batch_limit integer,
  execution_request_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = terms, pg_temp
AS $$
DECLARE
  affected integer;
BEGIN
  IF current_user <> 'terms_retention' THEN
    RAISE EXCEPTION 'retention identity required' USING ERRCODE = '42501';
  END IF;
  IF batch_limit < 1 OR batch_limit > 1000 THEN
    RAISE EXCEPTION 'batch limit outside 1..1000' USING ERRCODE = '22023';
  END IF;

  WITH due AS (
    SELECT acceptance_id
      FROM terms.terms_acceptances
     WHERE anonymized_at IS NULL AND retention_until <= transaction_timestamp()
     ORDER BY retention_until, acceptance_id
     LIMIT batch_limit
     FOR UPDATE SKIP LOCKED
  ), anonymized AS (
    UPDATE terms.terms_acceptances a
       SET actor_id=NULL, org_scope_id=NULL, actor_fingerprint=NULL,
           anonymized_at=transaction_timestamp()
      FROM due
     WHERE a.acceptance_id=due.acceptance_id
     RETURNING a.acceptance_id, a.version_id, a.retention_until
  )
  INSERT INTO terms.terms_audit_events (
    event_id, event_type, version_id, acceptance_id, actor_role,
    occurred_at, request_id, outcome, retention_until
  )
  SELECT (
      substr(md5(acceptance_id::text || execution_request_id::text),1,8) || '-' ||
      substr(md5(acceptance_id::text || execution_request_id::text),9,4) || '-' ||
      substr(md5(acceptance_id::text || execution_request_id::text),13,4) || '-' ||
      substr(md5(acceptance_id::text || execution_request_id::text),17,4) || '-' ||
      substr(md5(acceptance_id::text || execution_request_id::text),21,12)
    )::uuid,
    'retention', version_id, acceptance_id, 'system', transaction_timestamp(),
    execution_request_id, 'succeeded', retention_until
  FROM anonymized
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT SELECT (version_id) ON terms.terms_acceptances TO terms_retention;
REVOKE ALL ON FUNCTION terms.anonymize_expired_acceptances(integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION terms.anonymize_expired_acceptances(integer, uuid) TO terms_retention;
