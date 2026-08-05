import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { AppConfig } from "../../config/schema.js";
import type {
  AlternativeDataInput,
  ApplicationDraftInput,
} from "../../domain/applications/application.js";
import type { ActorContext } from "../../domain/authorization/policies.js";
import {
  applicationDraftSchema,
  toFieldValidationErrors,
} from "../../domain/applications/validation.js";
import { canonicalHash } from "../../infrastructure/crypto/canonical-hash.js";
import { inTransaction } from "../../infrastructure/db/transaction.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import {
  ApplicationRepository,
  type StoredApplication,
} from "./application.repository.js";
import {
  applicationCreatedEvent,
  applicationUpdatedEvent,
  consentRecordedEvent,
} from "./application-events.js";
import { CreateRevisionService } from "./create-revision.service.js";

export interface ApplicationResource {
  readonly applicationId: string;
  readonly state: string;
  readonly revisionNumber: number;
  readonly lockVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly draftExpiresAt: string | null;
  readonly applicant: StoredApplication["applicant"];
  readonly consent?: {
    readonly decision: string;
    readonly noticeVersion: string;
    readonly purposeCode: string;
    readonly recordedAt: string;
  };
  readonly alternativeData?: AlternativeDataInput;
}

export interface ApplicationServiceResult {
  readonly body: ApplicationResource;
  readonly status: number;
  readonly etag: string;
  readonly location?: string;
  readonly replayed?: boolean;
}

export type ApplicationErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_NOT_EDITABLE"
  | "DRAFT_ALREADY_EXISTS"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "PRECONDITION_FAILED"
  | "VALIDATION_FAILED";

export class ApplicationServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApplicationErrorCode,
    readonly detail: string,
    readonly errors: readonly unknown[] = [],
    readonly existingApplicationId?: string,
  ) {
    super(detail);
    this.name = "ApplicationServiceError";
  }
}

function etag(lockVersion: number): string {
  return `"${lockVersion.toString()}"`;
}

function resource(stored: StoredApplication): ApplicationResource {
  return {
    applicationId: stored.publicId,
    state: stored.state,
    revisionNumber: stored.revisionNumber,
    lockVersion: stored.lockVersion,
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString(),
    draftExpiresAt: stored.draftExpiresAt?.toISOString() ?? null,
    applicant: stored.applicant,
    ...(stored.consent
      ? {
          consent: {
            decision: stored.consent.decision,
            noticeVersion: stored.consent.noticeVersion,
            purposeCode: stored.consent.purposeCode,
            recordedAt: stored.consent.recordedAt.toISOString(),
          },
        }
      : {}),
    ...(stored.alternativeData
      ? { alternativeData: stored.alternativeData }
      : {}),
  };
}

function parseDraft(raw: unknown): ApplicationDraftInput {
  const parsed = applicationDraftSchema.safeParse(raw);
  if (!parsed.success)
    throw new ApplicationServiceError(
      422,
      "VALIDATION_FAILED",
      "Corrija los campos indicados antes de guardar.",
      toFieldValidationErrors(parsed.error),
    );
  if (parsed.data.consent?.decision === "revoked")
    throw new ApplicationServiceError(
      422,
      "VALIDATION_FAILED",
      "El consentimiento revocado no puede registrarse como una nueva decisión.",
      [
        {
          path: "consent.decision",
          code: "VAL-004",
          message: "Registre el consentimiento como aceptado o negado.",
        },
      ],
    );
  return parsed.data as ApplicationDraftInput;
}

function asPatch(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new ApplicationServiceError(
      422,
      "VALIDATION_FAILED",
      "El cambio debe ser un objeto con al menos un campo.",
    );
  const patch = raw as Record<string, unknown>;
  const keys = Object.keys(patch);
  if (!keys.length || keys.some((key) => !["applicant", "consent", "alternativeData"].includes(key)))
    throw new ApplicationServiceError(
      422,
      "VALIDATION_FAILED",
      "El cambio contiene campos no permitidos o está vacío.",
    );
  return patch;
}

function currentDraft(stored: StoredApplication): ApplicationDraftInput {
  const applicant = {
    documentType: stored.applicant.documentType,
    documentNumber: stored.applicant.documentNumber,
    fullName: stored.applicant.fullName,
    contact: stored.applicant.contact,
  };
  return {
    applicant,
    ...(stored.consent
      ? {
          consent: {
            decision: stored.consent.decision,
            noticeVersion: stored.consent.noticeVersion,
            purposeCode: stored.consent.purposeCode,
          },
        }
      : {}),
    ...(stored.alternativeData
      ? { alternativeData: stored.alternativeData }
      : {}),
  };
}

function mergeDraft(
  stored: StoredApplication,
  rawPatch: unknown,
): ApplicationDraftInput {
  const patch = asPatch(rawPatch);
  const current = currentDraft(stored);
  const alternativePatch = patch["alternativeData"];
  const mergedAlternative =
    alternativePatch &&
    typeof alternativePatch === "object" &&
    !Array.isArray(alternativePatch)
      ? {
          ...(current.alternativeData ?? {}),
          ...(alternativePatch as Record<string, unknown>),
        }
      : alternativePatch;
  return parseDraft({
    ...current,
    ...patch,
    ...(Object.hasOwn(patch, "alternativeData")
      ? { alternativeData: mergedAlternative }
      : {}),
  });
}

function parseEtag(value: string): number {
  const match = /^"([1-9][0-9]*)"$/.exec(value.trim());
  if (!match?.[1])
    throw new ApplicationServiceError(
      412,
      "PRECONDITION_FAILED",
      "La versión del borrador no es válida. Recargue la solicitud.",
    );
  return Number(match[1]);
}

export class ApplicationService {
  private readonly createRevisionService: CreateRevisionService;

  constructor(
    private readonly pool: pg.Pool,
    private readonly repository: ApplicationRepository,
    private readonly auditWriter: AuditWriter,
  ) {
    this.createRevisionService = new CreateRevisionService(repository);
  }

  async create(
    rawInput: unknown,
    actor: ActorContext,
    correlationId: string,
    idempotencyKey: string,
  ): Promise<ApplicationServiceResult> {
    const input = parseDraft(rawInput);
    const requestHash = canonicalHash(input);
    return inTransaction(this.pool, async (db) => {
      const prior = await this.repository.acquireIdempotency(
        db,
        actor,
        "createApplication",
        idempotencyKey,
        requestHash,
      );
      if (prior) {
        if (!prior.requestHash.equals(requestHash))
          throw new ApplicationServiceError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "La clave de idempotencia ya fue usada con datos diferentes.",
          );
        if (prior.state !== "completed" || !prior.responseBody)
          throw new ApplicationServiceError(
            409,
            "IDEMPOTENCY_IN_PROGRESS",
            "La solicitud con esta clave todavía está en proceso.",
          );
        const headers = prior.responseHeaders ?? {};
        return {
          body: prior.responseBody as ApplicationResource,
          status: prior.responseStatus ?? 201,
          etag: headers["ETag"] ?? '"1"',
          ...(headers["Location"] ? { location: headers["Location"] } : {}),
          replayed: true,
        };
      }

      const duplicate = await this.repository.findExistingDraft(
        db,
        actor,
        input.applicant.documentType,
        input.applicant.documentNumber,
      );
      if (duplicate)
        throw new ApplicationServiceError(
          409,
          "DRAFT_ALREADY_EXISTS",
          "Ya existe un borrador abierto para este solicitante.",
          [],
          duplicate,
        );

      const publicId = randomUUID();
      const expiresAt = new Date(Date.now() + 90 * 86_400_000);
      const created = await this.repository.createDraft(
        db,
        actor,
        input,
        publicId,
        expiresAt,
      );
      const stored = await this.repository.getByPublicId(actor, publicId, {}, db);
      if (!stored) throw new Error("Created application could not be loaded.");
      const body = resource(stored);
      const location = `/api/v1/applications/${publicId}`;
      const responseHeaders = { ETag: etag(stored.lockVersion), Location: location };
      await this.auditWriter.write(
        applicationCreatedEvent({
          actor,
          applicationId: created.applicationId,
          correlationId,
          revisionNumber: 1,
        }),
        db,
      );
      if (input.consent)
        await this.auditWriter.write(
          consentRecordedEvent(
            {
              actor,
              applicationId: created.applicationId,
              correlationId,
              revisionNumber: 1,
            },
            input.consent.decision,
          ),
          db,
        );
      await this.repository.completeIdempotency(
        db,
        actor,
        "createApplication",
        idempotencyKey,
        201,
        responseHeaders,
        body,
        created.applicationId,
      );
      return {
        body,
        status: 201,
        etag: responseHeaders.ETag,
        location,
        replayed: false,
      };
    });
  }

  async get(
    publicId: string,
    actor: ActorContext,
  ): Promise<ApplicationServiceResult> {
    const stored = await this.repository.getByPublicId(actor, publicId);
    if (!stored)
      throw new ApplicationServiceError(
        404,
        "APPLICATION_NOT_FOUND",
        "No se encontró la solicitud solicitada.",
      );
    return {
      body: resource(stored),
      status: 200,
      etag: etag(stored.lockVersion),
    };
  }

  async update(
    publicId: string,
    rawPatch: unknown,
    ifMatch: string,
    actor: ActorContext,
    correlationId: string,
  ): Promise<ApplicationServiceResult> {
    const expectedLockVersion = parseEtag(ifMatch);
    return inTransaction(this.pool, async (db) => {
      const stored = await this.repository.getByPublicId(
        actor,
        publicId,
        { forUpdate: true },
        db,
      );
      if (!stored)
        throw new ApplicationServiceError(
          404,
          "APPLICATION_NOT_FOUND",
          "No se encontró la solicitud solicitada.",
        );
      if (stored.state === "evaluando")
        throw new ApplicationServiceError(
          409,
          "APPLICATION_NOT_EDITABLE",
          "La evaluación actual todavía está en proceso.",
        );
      if (stored.lockVersion !== expectedLockVersion)
        throw new ApplicationServiceError(
          412,
          "PRECONDITION_FAILED",
          "El borrador cambió desde la última lectura. Recargue antes de guardar.",
        );
      const input = mergeDraft(stored, rawPatch);
      const updated =
        stored.state === "borrador"
          ? await this.repository.updateDraft(db, actor, stored, input)
          : await this.createRevisionService.execute(db, actor, stored, input);
      if (!updated)
        throw new ApplicationServiceError(
          412,
          "PRECONDITION_FAILED",
          "El borrador cambió desde la última lectura. Recargue antes de guardar.",
        );
      await this.auditWriter.write(
        applicationUpdatedEvent({
          actor,
          applicationId: stored.id,
          correlationId,
          revisionNumber: updated.revisionNumber,
        }),
        db,
      );
      if (Object.hasOwn(asPatch(rawPatch), "consent"))
        await this.auditWriter.write(
          consentRecordedEvent(
            {
              actor,
              applicationId: stored.id,
              correlationId,
              revisionNumber: updated.revisionNumber,
            },
            input.consent?.decision ?? "absent",
          ),
          db,
        );
      return {
        body: resource(updated),
        status: 200,
        etag: etag(updated.lockVersion),
      };
    });
  }
}

export function createApplicationService(
  pool: pg.Pool,
  config: AppConfig,
  auditWriter: AuditWriter,
): ApplicationService {
  return new ApplicationService(
    pool,
    new ApplicationRepository(pool, config),
    auditWriter,
  );
}
