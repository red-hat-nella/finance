BEGIN;
INSERT INTO scoring.criteria_versions(version,status,algorithm_name,input_schema_version,weights,rules,bands,rounding_mode,checksum,effective_from,created_by)
VALUES('SCORING-MVP-1.0.0','active','weighted-alternative-score','1.0.0',
 '{"utility":0.40,"mobile":0.30,"income":0.30}',
 '{"utilityBuckets":[0,25,50,75,100],"minimumObservationMonths":6,"factorTieBreak":["utility","mobile","income"]}',
 '{"riesgo_alto":[300,549],"riesgo_medio":[550,699],"riesgo_bajo":[700,850]}',
 'ROUND_HALF_UP',digest('SCORING-MVP-1.0.0|0.40|0.30|0.30|300|850','sha256'),'2026-08-04T00:00:00Z','migration')
ON CONFLICT(version) DO NOTHING;
INSERT INTO scoring.audit_events(
 event_id,occurred_at,actor_id,actor_roles,event_type,correlation_id,outcome,metadata
)
VALUES(
 '00000000-0000-4000-8000-000000000106','2026-08-04T00:00:00Z','system:migration',ARRAY['system'],
 'CRITERIA_VERSION_ACTIVATED','00000000-0000-4000-8000-000000000006','success',
 '{"criteriaVersion":"SCORING-MVP-1.0.0","fromStatus":"unavailable","toStatus":"active"}'
)
ON CONFLICT(event_id) DO NOTHING;
COMMIT;
