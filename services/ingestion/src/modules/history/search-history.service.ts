import { z } from "zod";
import type { AppConfig } from "../../config/schema.js";
import { DOCUMENT_TYPES } from "../../domain/applications/application.js";
import {
  isValidDocument,
  toFieldValidationErrors,
} from "../../domain/applications/validation.js";
import { normalizeDocumentNumber } from "../../domain/applications/normalization.js";
import { documentBlindIndex } from "../../infrastructure/crypto/blind-index.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import type { HistoryRepository } from "./history.repository.js";
import {
  HISTORY_PAGE_SIZE,
  TERMINAL_EVALUATION_STATES,
  type EvaluationHistoryPage,
} from "./history.models.js";

const ALL_FILTER_STATES = [
  "borrador",
  "evaluando",
  ...TERMINAL_EVALUATION_STATES,
] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const historySearchSchema = z
  .object({
    page: z.number().int().min(1),
    evaluationId: z.uuid().optional(),
    applicantIdentifier: z
      .object({
        documentType: z.enum(DOCUMENT_TYPES),
        documentNumber: z.string(),
      })
      .strict()
      .optional(),
    dateFrom: z.string().regex(ISO_DATE).optional(),
    dateTo: z.string().regex(ISO_DATE).optional(),
    states: z.array(z.enum(ALL_FILTER_STATES)).min(1).max(5).optional(),
  })
  .strict()
  .superRefine((filters, context) => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)
      context.addIssue({
        code: "custom",
        message: "VAL-016",
        path: ["dateFrom"],
      });
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (
      (filters.dateFrom && filters.dateFrom > today) ||
      (filters.dateTo && filters.dateTo > today)
    )
      context.addIssue({
        code: "custom",
        message: "VAL-016",
        path: ["dateFrom"],
      });
    if (filters.applicantIdentifier) {
      const normalized = normalizeDocumentNumber(
        filters.applicantIdentifier.documentType,
        filters.applicantIdentifier.documentNumber,
      );
      if (
        !isValidDocument(filters.applicantIdentifier.documentType, normalized)
      )
        context.addIssue({
          code: "custom",
          message: "VAL-001",
          path: ["applicantIdentifier", "documentNumber"],
        });
    }
  });

export class HistoryValidationError extends Error {
  constructor(readonly errors: ReturnType<typeof toFieldValidationErrors>) {
    super("Los filtros del histórico no son válidos.");
    this.name = "HistoryValidationError";
  }
}

export interface HistoryActor {
  readonly actorId: string;
  readonly orgId: string;
  readonly roles: readonly string[];
}

export class SearchHistoryService {
  constructor(
    private readonly repository: HistoryRepository,
    private readonly auditWriter: AuditWriter,
    private readonly config: AppConfig,
  ) {}

  async execute(
    rawFilters: unknown,
    actor: HistoryActor,
    correlationId: string,
  ): Promise<EvaluationHistoryPage> {
    const parsed = historySearchSchema.safeParse(rawFilters);
    if (!parsed.success)
      throw new HistoryValidationError(toFieldValidationErrors(parsed.error));
    const input = parsed.data;
    const requestedStates = input.states ?? [...TERMINAL_EVALUATION_STATES];
    const states = requestedStates.filter((state) =>
      TERMINAL_EVALUATION_STATES.includes(
        state as (typeof TERMINAL_EVALUATION_STATES)[number],
      ),
    ) as (typeof TERMINAL_EVALUATION_STATES)[number][];

    const document = input.applicantIdentifier;
    const documentIndex = document
      ? documentBlindIndex(
          actor.orgId,
          document.documentType,
          normalizeDocumentNumber(
            document.documentType,
            document.documentNumber,
          ),
          this.config.pii.hmacKey,
        )
      : undefined;
    const result = states.length
      ? await this.repository.search(
          {
            orgId: actor.orgId,
            ...(actor.roles.includes("credit_analyst")
              ? { ownerActorId: actor.actorId }
              : {}),
          },
          {
            page: input.page,
            states,
            ...(input.evaluationId ? { evaluationId: input.evaluationId } : {}),
            ...(documentIndex ? { documentBlindIndex: documentIndex } : {}),
            ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
            ...(input.dateTo ? { dateTo: input.dateTo } : {}),
          },
        )
      : { items: [], totalItems: 0 };

    const filterTypes = [
      input.evaluationId ? "evaluationId" : null,
      document ? "applicantIdentifier" : null,
      input.dateFrom || input.dateTo ? "dateRange" : null,
      input.states ? "states" : null,
    ].filter((value): value is string => value !== null);
    await this.auditWriter.write({
      type: "HISTORY_SEARCHED",
      orgId: actor.orgId,
      actorId: actor.actorId,
      roles: actor.roles,
      correlationId,
      outcome: "success",
      metadata: {
        filterTypes: filterTypes.join(","),
        resultCount: result.totalItems,
      },
    });

    return {
      items: result.items,
      page: input.page,
      pageSize: HISTORY_PAGE_SIZE,
      totalItems: result.totalItems,
      totalPages: Math.ceil(result.totalItems / HISTORY_PAGE_SIZE),
    };
  }
}
