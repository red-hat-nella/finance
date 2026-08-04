BEGIN;
CREATE TABLE scoring.alternative_data_sets (
 revision_id uuid PRIMARY KEY REFERENCES scoring.application_revisions(id) ON DELETE CASCADE,
 income_status varchar(16) NOT NULL CHECK(income_status IN ('provided','unavailable')),
 income_unavailable_reason varchar(240), utilities_status varchar(16) NOT NULL CHECK(utilities_status IN ('provided','unavailable')),
 utilities_unavailable_reason varchar(240), mobile_status varchar(16) NOT NULL CHECK(mobile_status IN ('provided','unavailable')),
 mobile_unavailable_reason varchar(240),
 CONSTRAINT ck_income_availability CHECK ((income_status='unavailable')=(length(income_unavailable_reason) BETWEEN 10 AND 240)),
 CONSTRAINT ck_utilities_availability CHECK ((utilities_status='unavailable')=(length(utilities_unavailable_reason) BETWEEN 10 AND 240)),
 CONSTRAINT ck_mobile_availability CHECK ((mobile_status='unavailable')=(length(mobile_unavailable_reason) BETWEEN 10 AND 240))
);
CREATE TABLE scoring.income_details (
 revision_id uuid PRIMARY KEY REFERENCES scoring.application_revisions(id) ON DELETE CASCADE,
 monthly_income_cop numeric(12,2) NOT NULL CHECK(monthly_income_cop>0 AND monthly_income_cop<=9999999999.99),
 source_type varchar(24) NOT NULL CHECK(source_type IN ('employment','self_employed','pension','remittance','other')),
 source_other_description varchar(80), stability_months smallint NOT NULL CHECK(stability_months BETWEEN 0 AND 600),
 CONSTRAINT ck_income_other CHECK ((source_type='other')=(length(source_other_description) BETWEEN 3 AND 80))
);
CREATE TABLE scoring.utility_references (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES scoring.application_revisions(id) ON DELETE CASCADE,
 ordinal smallint NOT NULL CHECK(ordinal BETWEEN 1 AND 3), service_type varchar(24) NOT NULL CHECK(service_type IN ('electricity','water','gas','internet','other')),
 period_start date NOT NULL, period_end date NOT NULL CHECK(period_end>=period_start AND period_end<=current_date),
 observed_months smallint NOT NULL CHECK(observed_months BETWEEN 1 AND 12), total_obligations smallint NOT NULL CHECK(total_obligations BETWEEN 1 AND 12),
 on_time_count smallint NOT NULL CHECK(on_time_count>=0), late_count smallint NOT NULL CHECK(late_count>=0), missed_count smallint NOT NULL CHECK(missed_count>=0),
 average_monthly_amount_cop numeric(12,2) NOT NULL CHECK(average_monthly_amount_cop>0),
 UNIQUE(revision_id,ordinal), CONSTRAINT ck_utility_counts CHECK(on_time_count+late_count+missed_count=total_obligations)
);
CREATE INDEX ix_utility_period ON scoring.utility_references(revision_id,service_type,period_start,period_end);
CREATE TABLE scoring.mobile_details (
 revision_id uuid PRIMARY KEY REFERENCES scoring.application_revisions(id) ON DELETE CASCADE,
 mode varchar(16) NOT NULL CHECK(mode IN ('prepaid','postpaid')), tenure_months smallint NOT NULL CHECK(tenure_months BETWEEN 0 AND 600),
 observed_months smallint NOT NULL CHECK(observed_months BETWEEN 1 AND 12), regular_months smallint NOT NULL CHECK(regular_months BETWEEN 0 AND observed_months)
);
CREATE OR REPLACE FUNCTION scoring.assert_alternative_data_complete(target_revision uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE availability scoring.alternative_data_sets%ROWTYPE;
BEGIN
 SELECT * INTO STRICT availability FROM scoring.alternative_data_sets WHERE revision_id=target_revision;
 IF (availability.income_status='provided') <> EXISTS(SELECT 1 FROM scoring.income_details WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'income availability and detail are inconsistent'; END IF;
 IF (availability.mobile_status='provided') <> EXISTS(SELECT 1 FROM scoring.mobile_details WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'mobile availability and detail are inconsistent'; END IF;
 IF availability.utilities_status='provided' AND NOT EXISTS(SELECT 1 FROM scoring.utility_references WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'provided utilities require at least one reference'; END IF;
 IF availability.utilities_status='unavailable' AND EXISTS(SELECT 1 FROM scoring.utility_references WHERE revision_id=target_revision) THEN RAISE EXCEPTION 'unavailable utilities cannot have references'; END IF;
 IF (SELECT count(*) FROM scoring.utility_references WHERE revision_id=target_revision)>3 THEN RAISE EXCEPTION 'at most three utility references are allowed'; END IF;
END $$;
COMMIT;
