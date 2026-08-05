import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import type {
  AlternativeDataInput,
  ApplicationDraftInput,
  ConsentInput,
} from "../../domain/applications/application.js";
import type { ActorContext } from "../../domain/authorization/policies.js";
import { documentBlindIndex } from "../../infrastructure/crypto/blind-index.js";
import {
  decryptField,
  encryptField,
  type CipherField,
} from "../../infrastructure/crypto/field-crypto.js";

type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;

export interface StoredApplication {
  readonly id: string;
  readonly publicId: string;
  readonly ownerActorId: string;
  readonly state: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly draftExpiresAt: Date | null;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly lockVersion: number;
  readonly applicant: ApplicationDraftInput["applicant"] & {
    readonly documentMasked: string;
    readonly displayName: string;
  };
  readonly consent?: ConsentInput & { readonly recordedAt: Date };
  readonly alternativeData?: AlternativeDataInput;
}

interface ApplicationRow {
  id: string;
  public_id: string;
  owner_actor_id: string;
  current_status: string;
  created_at: Date;
  updated_at: Date;
  draft_expires_at: Date | null;
  revision_id: string;
  revision_number: number;
  lock_version: number;
  document_type: ApplicationDraftInput["applicant"]["documentType"];
  document_ciphertext: Buffer;
  document_nonce: Buffer;
  document_tag: Buffer;
  document_masked: string;
  full_name_ciphertext: Buffer;
  full_name_nonce: Buffer;
  full_name_tag: Buffer;
  display_name: string;
  phone_ciphertext: Buffer | null;
  phone_nonce: Buffer | null;
  phone_tag: Buffer | null;
  email_ciphertext: Buffer | null;
  email_nonce: Buffer | null;
  email_tag: Buffer | null;
  consent_status: ConsentInput["decision"] | null;
  notice_version: string | null;
  purpose_code: ConsentInput["purposeCode"] | null;
  recorded_at: Date | null;
  income_status: "provided" | "unavailable" | null;
  income_unavailable_reason: string | null;
  monthly_income_cop: string | null;
  source_type: "employment" | "self_employed" | "pension" | "other" | null;
  source_other_description: string | null;
  stability_months: number | null;
  utilities_status: "provided" | "unavailable" | null;
  utilities_unavailable_reason: string | null;
  mobile_status: "provided" | "unavailable" | null;
  mobile_unavailable_reason: string | null;
  mobile_mode: "prepaid" | "postpaid" | null;
  tenure_months: number | null;
  mobile_observed_months: number | null;
  regular_months: number | null;
}

interface UtilityRow {
  service_type: "electricity" | "water" | "gas" | "internet" | "other";
  period_start: Date | string;
  period_end: Date | string;
  observed_months: number;
  total_obligations: number;
  on_time_count: number;
  late_count: number;
  missed_count: number;
  average_monthly_amount_cop: string;
}

interface CreatedIds {
  readonly applicationId: string;
  readonly applicationPublicId: string;
  readonly revisionId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly draftExpiresAt: Date;
}

export interface IdempotencyRecord {
  readonly requestHash: Buffer;
  readonly state: "in_progress" | "completed" | "failed";
  readonly responseStatus: number | null;
  readonly responseHeaders: Record<string, string> | null;
  readonly responseBody: unknown;
}

function displayName(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0] ?? name;
  const last = words.at(-1);
  return words.length > 1 && last
    ? `${first} ${last.charAt(0)}.`
    : first;
}

function masked(type: string, number: string): string {
  return `${type} ••••••${number.slice(-4)}`;
}

function encrypted(value: string | undefined, key: Buffer): CipherField | null {
  return value ? encryptField(value, key) : null;
}

function dateOnly(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

export class ApplicationRepository {
  constructor(
    private readonly pool: pg.Pool,
    private readonly config: AppConfig,
  ) {}

  async findExistingDraft(
    db: Queryable,
    actor: ActorContext,
    documentType: string,
    documentNumber: string,
  ): Promise<string | null> {
    const blindIndex = documentBlindIndex(
      actor.orgId,
      documentType,
      documentNumber,
      this.config.pii.hmacKey,
    );
    const result = await db.query<{ public_id: string }>(
      `SELECT a.public_id
         FROM scoring.applications a
         JOIN scoring.applicants p ON p.id = a.applicant_id
        WHERE a.org_scope_id = $1
          AND a.owner_actor_id = $2
          AND a.current_status = 'borrador'
          AND a.deleted_at IS NULL
          AND p.document_type = $3
          AND p.document_blind_index = $4
        LIMIT 1`,
      [actor.orgId, actor.actorId, documentType, blindIndex],
    );
    return result.rows[0]?.public_id ?? null;
  }

  async createDraft(
    db: Queryable,
    actor: ActorContext,
    input: ApplicationDraftInput,
    publicId: string,
    expiresAt: Date,
  ): Promise<CreatedIds> {
    const identity = this.encryptIdentity(actor.orgId, input);
    const applicantId = await this.upsertApplicant(db, identity.applicantValues);

    const application = await db.query<{
      id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO scoring.applications(
         public_id,org_scope_id,owner_actor_id,applicant_id,current_status,draft_expires_at
       ) VALUES($1,$2,$3,$4,'borrador',$5)
       RETURNING id,created_at,updated_at`,
      [publicId, actor.orgId, actor.actorId, applicantId, expiresAt],
    );
    const app = application.rows[0];
    if (!app) throw new Error("Application insert did not return an ID.");

    const consentId = input.consent
      ? await this.insertConsent(db, app.id, actor.actorId, input.consent)
      : null;
    const revision = await db.query<{ id: string }>(
      `INSERT INTO scoring.application_revisions(
         application_id,revision_number,consent_id,status,created_by_actor_id,draft_expires_at
       ) VALUES($1,1,$2,'borrador',$3,$4) RETURNING id`,
      [app.id, consentId, actor.actorId, expiresAt],
    );
    const revisionId = revision.rows[0]?.id;
    if (!revisionId) throw new Error("Revision insert did not return an ID.");
    await this.insertIdentitySnapshot(db, revisionId, identity.snapshotValues);
    await this.replaceAlternativeData(db, revisionId, input.alternativeData);
    await db.query(
      `UPDATE scoring.applications
          SET current_revision_id=$2,revision_count=1,updated_at=now()
        WHERE id=$1`,
      [app.id, revisionId],
    );
    return {
      applicationId: app.id,
      applicationPublicId: publicId,
      revisionId,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      draftExpiresAt: expiresAt,
    };
  }

  async getByPublicId(
    actor: ActorContext,
    publicId: string,
    options: { readonly forUpdate?: boolean } = {},
    db: Queryable = this.pool,
  ): Promise<StoredApplication | null> {
    const ownerOnly = actor.roles.includes("credit_analyst");
    const result = await db.query<ApplicationRow>(
      `${this.applicationSelect()}
        WHERE a.public_id=$1 AND a.org_scope_id=$2
          AND ($3::boolean = false OR a.owner_actor_id=$4)
          AND a.deleted_at IS NULL
        ${options.forUpdate ? "FOR UPDATE OF a,r" : ""}`,
      [publicId, actor.orgId, ownerOnly, actor.actorId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const utilities = await db.query<UtilityRow>(
      `SELECT service_type,period_start,period_end,observed_months,total_obligations,
              on_time_count,late_count,missed_count,average_monthly_amount_cop
         FROM scoring.utility_references WHERE revision_id=$1 ORDER BY ordinal`,
      [row.revision_id],
    );
    return this.mapRow(row, utilities.rows);
  }

  async updateDraft(
    db: Queryable,
    actor: ActorContext,
    current: StoredApplication,
    input: ApplicationDraftInput,
  ): Promise<StoredApplication | null> {
    const identity = this.encryptIdentity(actor.orgId, input);
    const applicantId = await this.upsertApplicant(db, identity.applicantValues);
    const lock = await db.query<{ lock_version: number; updated_at: Date }>(
      `UPDATE scoring.application_revisions
          SET lock_version=lock_version+1,updated_at=now(),
              consent_id=COALESCE($4,consent_id)
        WHERE id=$1 AND lock_version=$2 AND status='borrador'
          AND EXISTS (
            SELECT 1 FROM scoring.applications a
             WHERE a.id=application_id AND a.org_scope_id=$3 AND a.owner_actor_id=$5
          )
        RETURNING lock_version,updated_at`,
      [
        current.revisionId,
        current.lockVersion,
        actor.orgId,
        input.consent
          ? await this.insertConsent(
              db,
              current.id,
              actor.actorId,
              input.consent,
            )
          : null,
        actor.actorId,
      ],
    );
    if (!lock.rows[0]) return null;

    await db.query(
      `UPDATE scoring.revision_identity_snapshots SET
         document_type=$2,document_blind_index=$3,document_ciphertext=$4,document_nonce=$5,document_tag=$6,
         document_masked=$7,full_name_ciphertext=$8,full_name_nonce=$9,full_name_tag=$10,display_name=$11,
         phone_ciphertext=$12,phone_nonce=$13,phone_tag=$14,email_ciphertext=$15,email_nonce=$16,email_tag=$17,
         pii_key_version=$18 WHERE revision_id=$1`,
      [current.revisionId, ...identity.snapshotValues],
    );
    await this.replaceAlternativeData(db, current.revisionId, input.alternativeData);
    await db.query(
      `UPDATE scoring.applications SET updated_at=now(),draft_expires_at=$2,applicant_id=$5
        WHERE id=$1 AND org_scope_id=$3 AND owner_actor_id=$4`,
      [current.id, current.draftExpiresAt, actor.orgId, actor.actorId, applicantId],
    );
    return this.getByPublicId(actor, current.publicId, {}, db);
  }

  async createRevision(
    db: Queryable,
    actor: ActorContext,
    current: StoredApplication,
    input: ApplicationDraftInput,
    expiresAt: Date,
  ): Promise<StoredApplication | null> {
    const identity = this.encryptIdentity(actor.orgId, input);
    const applicantId = await this.upsertApplicant(db, identity.applicantValues);
    const consentId = input.consent
      ? await this.insertConsent(db, current.id, actor.actorId, input.consent)
      : null;
    const revision = await db.query<{ id: string }>(
      `INSERT INTO scoring.application_revisions(
         application_id,revision_number,consent_id,status,created_by_actor_id,draft_expires_at
       ) VALUES($1,$2,$3,'borrador',$4,$5) RETURNING id`,
      [
        current.id,
        current.revisionNumber + 1,
        consentId,
        actor.actorId,
        expiresAt,
      ],
    );
    const revisionId = revision.rows[0]?.id;
    if (!revisionId) throw new Error("Revision insert did not return an ID.");
    await this.insertIdentitySnapshot(db, revisionId, identity.snapshotValues);
    await this.replaceAlternativeData(db, revisionId, input.alternativeData);
    const updated = await db.query(
      `UPDATE scoring.applications SET
         current_revision_id=$2,current_evaluation_id=NULL,current_status='borrador',
         revision_count=revision_count+1,draft_expires_at=$3,applicant_id=$4,updated_at=now()
       WHERE id=$1 AND org_scope_id=$5 AND owner_actor_id=$6
         AND current_revision_id=$7 AND current_status IN ('evaluada','revision_manual','error')`,
      [
        current.id,
        revisionId,
        expiresAt,
        applicantId,
        actor.orgId,
        actor.actorId,
        current.revisionId,
      ],
    );
    if ((updated.rowCount ?? 0) !== 1) return null;
    return this.getByPublicId(actor, current.publicId, {}, db);
  }

  async acquireIdempotency(
    db: Queryable,
    actor: ActorContext,
    operation: string,
    key: string,
    requestHash: Buffer,
  ): Promise<IdempotencyRecord | null> {
    const inserted = await db.query(
      `INSERT INTO scoring.idempotency_records(
         org_scope_id,actor_id,operation,idempotency_key,request_hash,state,expires_at
       ) VALUES($1,$2,$3,$4,$5,'in_progress',now()+interval '24 hours')
       ON CONFLICT DO NOTHING`,
      [actor.orgId, actor.actorId, operation, key, requestHash],
    );
    if ((inserted.rowCount ?? 0) === 1) return null;
    const existing = await db.query<{
      request_hash: Buffer;
      state: IdempotencyRecord["state"];
      response_status: number | null;
      response_headers: Record<string, string> | null;
      response_body: unknown;
    }>(
      `SELECT request_hash,state,response_status,response_headers,response_body
         FROM scoring.idempotency_records
        WHERE org_scope_id=$1 AND actor_id=$2 AND operation=$3 AND idempotency_key=$4
        FOR UPDATE`,
      [actor.orgId, actor.actorId, operation, key],
    );
    const row = existing.rows[0];
    return row
      ? {
          requestHash: row.request_hash,
          state: row.state,
          responseStatus: row.response_status,
          responseHeaders: row.response_headers,
          responseBody: row.response_body,
        }
      : null;
  }

  async completeIdempotency(
    db: Queryable,
    actor: ActorContext,
    operation: string,
    key: string,
    status: number,
    headers: Record<string, string>,
    body: unknown,
    resourceId: string,
  ): Promise<void> {
    await db.query(
      `UPDATE scoring.idempotency_records
          SET state='completed',response_status=$5,response_headers=$6::jsonb,
              response_body=$7::jsonb,resource_id=$8,updated_at=now()
        WHERE org_scope_id=$1 AND actor_id=$2 AND operation=$3 AND idempotency_key=$4`,
      [
        actor.orgId,
        actor.actorId,
        operation,
        key,
        status,
        JSON.stringify(headers),
        JSON.stringify(body),
        resourceId,
      ],
    );
  }

  private encryptIdentity(orgId: string, input: ApplicationDraftInput) {
    const applicant = input.applicant;
    const document = encryptField(
      applicant.documentNumber,
      this.config.pii.encryptionKey,
    );
    const name = encryptField(applicant.fullName, this.config.pii.encryptionKey);
    const phone = encrypted(applicant.contact.phone, this.config.pii.encryptionKey);
    const email = encrypted(applicant.contact.email, this.config.pii.encryptionKey);
    const values = [
      applicant.documentType,
      documentBlindIndex(
        orgId,
        applicant.documentType,
        applicant.documentNumber,
        this.config.pii.hmacKey,
      ),
      document.ciphertext,
      document.nonce,
      document.tag,
      masked(applicant.documentType, applicant.documentNumber),
      name.ciphertext,
      name.nonce,
      name.tag,
      displayName(applicant.fullName),
      phone?.ciphertext ?? null,
      phone?.nonce ?? null,
      phone?.tag ?? null,
      email?.ciphertext ?? null,
      email?.nonce ?? null,
      email?.tag ?? null,
      this.config.pii.keyVersion,
    ];
    return {
      applicantValues: [orgId, ...values],
      snapshotValues: values,
    };
  }

  private async upsertApplicant(
    db: Queryable,
    values: unknown[],
  ): Promise<string> {
    const applicant = await db.query<{ id: string }>(
      `INSERT INTO scoring.applicants(
         org_scope_id,document_type,document_blind_index,
         document_ciphertext,document_nonce,document_tag,document_masked,
         full_name_ciphertext,full_name_nonce,full_name_tag,display_name,
         phone_ciphertext,phone_nonce,phone_tag,email_ciphertext,email_nonce,email_tag,pii_key_version
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT(org_scope_id,document_type,document_blind_index) WHERE deleted_at IS NULL
       DO UPDATE SET
         document_ciphertext=EXCLUDED.document_ciphertext, document_nonce=EXCLUDED.document_nonce,
         document_tag=EXCLUDED.document_tag, document_masked=EXCLUDED.document_masked,
         full_name_ciphertext=EXCLUDED.full_name_ciphertext, full_name_nonce=EXCLUDED.full_name_nonce,
         full_name_tag=EXCLUDED.full_name_tag, display_name=EXCLUDED.display_name,
         phone_ciphertext=EXCLUDED.phone_ciphertext, phone_nonce=EXCLUDED.phone_nonce, phone_tag=EXCLUDED.phone_tag,
         email_ciphertext=EXCLUDED.email_ciphertext, email_nonce=EXCLUDED.email_nonce, email_tag=EXCLUDED.email_tag,
         pii_key_version=EXCLUDED.pii_key_version, updated_at=now()
       RETURNING id`,
      values,
    );
    const applicantId = applicant.rows[0]?.id;
    if (!applicantId) throw new Error("Applicant upsert did not return an ID.");
    return applicantId;
  }

  private async insertConsent(
    db: Queryable,
    applicationId: string,
    actorId: string,
    consent: ConsentInput,
  ): Promise<string> {
    const result = await db.query<{ id: string }>(
      `INSERT INTO scoring.consents(
         application_id,status,notice_version,purpose_code,recorded_by_actor_id
       ) VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [
        applicationId,
        consent.decision,
        consent.noticeVersion,
        consent.purposeCode,
        actorId,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error("Consent insert did not return an ID.");
    return id;
  }

  private async insertIdentitySnapshot(
    db: Queryable,
    revisionId: string,
    values: readonly unknown[],
  ): Promise<void> {
    await db.query(
      `INSERT INTO scoring.revision_identity_snapshots(
         revision_id,document_type,document_blind_index,document_ciphertext,document_nonce,document_tag,
         document_masked,full_name_ciphertext,full_name_nonce,full_name_tag,display_name,
         phone_ciphertext,phone_nonce,phone_tag,email_ciphertext,email_nonce,email_tag,pii_key_version
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [revisionId, ...values],
    );
  }

  private async replaceAlternativeData(
    db: Queryable,
    revisionId: string,
    data: AlternativeDataInput | undefined,
  ): Promise<void> {
    await db.query(`DELETE FROM scoring.utility_references WHERE revision_id=$1`, [revisionId]);
    await db.query(`DELETE FROM scoring.income_details WHERE revision_id=$1`, [revisionId]);
    await db.query(`DELETE FROM scoring.mobile_details WHERE revision_id=$1`, [revisionId]);
    await db.query(`DELETE FROM scoring.alternative_data_sets WHERE revision_id=$1`, [revisionId]);
    if (!data || !Object.keys(data).length) return;
    await db.query(
      `INSERT INTO scoring.alternative_data_sets(
         revision_id,income_status,income_unavailable_reason,utilities_status,
         utilities_unavailable_reason,mobile_status,mobile_unavailable_reason
       ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        revisionId,
        data.income?.availability ?? null,
        data.income?.availability === "unavailable" ? data.income.reason : null,
        data.utilities?.availability ?? null,
        data.utilities?.availability === "unavailable" ? data.utilities.reason : null,
        data.mobile?.availability ?? null,
        data.mobile?.availability === "unavailable" ? data.mobile.reason : null,
      ],
    );
    if (data.income?.availability === "provided")
      await db.query(
        `INSERT INTO scoring.income_details(
           revision_id,monthly_income_cop,source_type,source_other_description,stability_months
         ) VALUES($1,$2,$3,$4,$5)`,
        [
          revisionId,
          data.income.monthlyIncomeCop,
          data.income.sourceType,
          data.income.sourceOtherDescription ?? null,
          data.income.stabilityMonths,
        ],
      );
    if (data.utilities?.availability === "provided")
      for (const [index, reference] of data.utilities.references.entries())
        await db.query(
          `INSERT INTO scoring.utility_references(
             revision_id,ordinal,service_type,period_start,period_end,observed_months,
             total_obligations,on_time_count,late_count,missed_count,average_monthly_amount_cop
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            revisionId,
            index + 1,
            reference.serviceType,
            reference.periodStart,
            reference.periodEnd,
            reference.observedMonths,
            reference.totalObligations,
            reference.onTimeCount,
            reference.lateCount,
            reference.missedCount,
            reference.averageMonthlyAmountCop,
          ],
        );
    if (data.mobile?.availability === "provided")
      await db.query(
        `INSERT INTO scoring.mobile_details(
           revision_id,mode,tenure_months,observed_months,regular_months
         ) VALUES($1,$2,$3,$4,$5)`,
        [
          revisionId,
          data.mobile.mode,
          data.mobile.tenureMonths,
          data.mobile.observedMonths,
          data.mobile.regularMonths,
        ],
      );
  }

  private applicationSelect(): string {
    return `SELECT
      a.id,a.public_id,a.owner_actor_id,a.current_status,a.created_at,a.updated_at,a.draft_expires_at,
      r.id revision_id,r.revision_number,r.lock_version,
      s.document_type,s.document_ciphertext,s.document_nonce,s.document_tag,s.document_masked,
      s.full_name_ciphertext,s.full_name_nonce,s.full_name_tag,s.display_name,
      s.phone_ciphertext,s.phone_nonce,s.phone_tag,s.email_ciphertext,s.email_nonce,s.email_tag,
      c.status consent_status,c.notice_version,c.purpose_code,c.recorded_at,
      d.income_status,d.income_unavailable_reason,i.monthly_income_cop,i.source_type,
      i.source_other_description,i.stability_months,
      d.utilities_status,d.utilities_unavailable_reason,
      d.mobile_status,d.mobile_unavailable_reason,m.mode mobile_mode,m.tenure_months,
      m.observed_months mobile_observed_months,m.regular_months
    FROM scoring.applications a
    JOIN scoring.application_revisions r ON r.id=a.current_revision_id
    JOIN scoring.revision_identity_snapshots s ON s.revision_id=r.id
    LEFT JOIN scoring.consents c ON c.id=r.consent_id
    LEFT JOIN scoring.alternative_data_sets d ON d.revision_id=r.id
    LEFT JOIN scoring.income_details i ON i.revision_id=r.id
    LEFT JOIN scoring.mobile_details m ON m.revision_id=r.id`;
  }

  private mapRow(row: ApplicationRow, utilityRows: readonly UtilityRow[]): StoredApplication {
    const key = this.config.pii.encryptionKey;
    const decrypt = (ciphertext: Buffer, nonce: Buffer, tag: Buffer) =>
      decryptField({ ciphertext, nonce, tag }, key);
    const contact: { phone?: string; email?: string } = {};
    if (row.phone_ciphertext && row.phone_nonce && row.phone_tag)
      contact.phone = decrypt(row.phone_ciphertext, row.phone_nonce, row.phone_tag);
    if (row.email_ciphertext && row.email_nonce && row.email_tag)
      contact.email = decrypt(row.email_ciphertext, row.email_nonce, row.email_tag);

    const alternativeData: {
      income?: NonNullable<AlternativeDataInput["income"]>;
      utilities?: NonNullable<AlternativeDataInput["utilities"]>;
      mobile?: NonNullable<AlternativeDataInput["mobile"]>;
    } = {};
    if (row.income_status === "unavailable" && row.income_unavailable_reason)
      alternativeData.income = {
        availability: "unavailable",
        reason: row.income_unavailable_reason,
      };
    if (
      row.income_status === "provided" &&
      row.monthly_income_cop !== null &&
      row.source_type !== null &&
      row.stability_months !== null
    )
      alternativeData.income = {
        availability: "provided",
        monthlyIncomeCop: row.monthly_income_cop,
        sourceType: row.source_type,
        ...(row.source_other_description
          ? { sourceOtherDescription: row.source_other_description }
          : {}),
        stabilityMonths: row.stability_months,
      };
    if (row.utilities_status === "unavailable" && row.utilities_unavailable_reason)
      alternativeData.utilities = {
        availability: "unavailable",
        reason: row.utilities_unavailable_reason,
      };
    if (row.utilities_status === "provided")
      alternativeData.utilities = {
        availability: "provided",
        references: utilityRows.map((reference) => ({
          serviceType: reference.service_type,
          periodStart: dateOnly(reference.period_start),
          periodEnd: dateOnly(reference.period_end),
          observedMonths: reference.observed_months,
          totalObligations: reference.total_obligations,
          onTimeCount: reference.on_time_count,
          lateCount: reference.late_count,
          missedCount: reference.missed_count,
          averageMonthlyAmountCop: reference.average_monthly_amount_cop,
        })),
      };
    if (row.mobile_status === "unavailable" && row.mobile_unavailable_reason)
      alternativeData.mobile = {
        availability: "unavailable",
        reason: row.mobile_unavailable_reason,
      };
    if (
      row.mobile_status === "provided" &&
      row.mobile_mode !== null &&
      row.tenure_months !== null &&
      row.mobile_observed_months !== null &&
      row.regular_months !== null
    )
      alternativeData.mobile = {
        availability: "provided",
        mode: row.mobile_mode,
        tenureMonths: row.tenure_months,
        observedMonths: row.mobile_observed_months,
        regularMonths: row.regular_months,
      };

    return {
      id: row.id,
      publicId: row.public_id,
      ownerActorId: row.owner_actor_id,
      state: row.current_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      draftExpiresAt: row.draft_expires_at,
      revisionId: row.revision_id,
      revisionNumber: row.revision_number,
      lockVersion: row.lock_version,
      applicant: {
        documentType: row.document_type,
        documentNumber: decrypt(
          row.document_ciphertext,
          row.document_nonce,
          row.document_tag,
        ),
        documentMasked: row.document_masked,
        fullName: decrypt(
          row.full_name_ciphertext,
          row.full_name_nonce,
          row.full_name_tag,
        ),
        displayName: row.display_name,
        contact,
      },
      ...(row.consent_status && row.notice_version && row.purpose_code && row.recorded_at
        ? {
            consent: {
              decision: row.consent_status,
              noticeVersion: row.notice_version,
              purposeCode: row.purpose_code,
              recordedAt: row.recorded_at,
            },
          }
        : {}),
      ...(Object.keys(alternativeData).length ? { alternativeData } : {}),
    };
  }
}
