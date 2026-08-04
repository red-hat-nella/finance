BEGIN;
INSERT INTO scoring.criteria_versions(version,status,algorithm_name,input_schema_version,weights,rules,bands,rounding_mode,checksum,effective_from,created_by)
VALUES('SCORING-MVP-1.0.0','active','weighted-alternative-score','1.0.0',
 '{"utility":0.40,"mobile":0.30,"income":0.30}',
 '{"utilityBuckets":[0,25,50,75,100],"minimumObservationMonths":6,"factorTieBreak":["utility","mobile","income"]}',
 '{"riesgo_alto":[300,549],"riesgo_medio":[550,699],"riesgo_bajo":[700,850]}',
 'ROUND_HALF_UP',digest('SCORING-MVP-1.0.0|0.40|0.30|0.30|300|850','sha256'),'2026-08-04T00:00:00Z','migration')
ON CONFLICT(version) DO NOTHING;
COMMIT;

