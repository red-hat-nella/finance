import { z } from "zod";
import type { components } from "./generated/terms-access.js";

const versionId = z.uuid();
const checkedAt = z.iso.datetime({ offset: true });
const acceptedDecision = z
  .object({
    allowed: z.literal(true),
    currentVersionId: versionId,
    currentVersionCode: z.string().min(1).max(64),
    acceptedVersionId: versionId,
    checkedAt,
    reason: z.literal("ACCEPTED"),
  })
  .strict()
  .refine((decision) => decision.currentVersionId === decision.acceptedVersionId, {
    message: "accepted version must match the current version",
  });
const requiredDecision = z
  .object({
    allowed: z.literal(false),
    currentVersionId: versionId,
    currentVersionCode: z.string().min(1).max(64),
    acceptedVersionId: z.null(),
    checkedAt,
    reason: z.literal("ACCEPTANCE_REQUIRED"),
    acceptanceUrl: z.string().regex(/^\/terms(?:\/|$)/),
  })
  .strict();
const noEffectiveVersionDecision = z
  .object({
    allowed: z.literal(false),
    currentVersionId: z.null(),
    currentVersionCode: z.null(),
    acceptedVersionId: z.null(),
    checkedAt,
    reason: z.literal("NO_EFFECTIVE_VERSION"),
  })
  .strict();
const decisionSchema = z.union([
  acceptedDecision,
  requiredDecision,
  noEffectiveVersionDecision,
]);

export type TermsAccessDecision = z.infer<typeof decisionSchema> &
  components["schemas"]["AccessDecision"];

export interface TermsAccessCommand {
  readonly authorization: string;
  readonly requestId: string;
}

export interface TermsAccessConfig {
  readonly baseUrl: string;
  readonly timeoutMs: 500;
  readonly token: string;
}

export type TermsAccessErrorCode =
  | "TERMS_ACCESS_TIMEOUT"
  | "TERMS_ACCESS_UNAVAILABLE"
  | "TERMS_ACCESS_RESPONSE_INVALID"
  | "TERMS_ACCESS_CIRCUIT_OPEN";

export class TermsAccessClientError extends Error {
  constructor(readonly code: TermsAccessErrorCode) {
    super(code);
    this.name = "TermsAccessClientError";
  }
}

export interface TermsCircuitOptions {
  readonly failureThreshold?: number;
  readonly resetMs?: number;
  readonly now?: () => number;
}

export class TermsAccessClient {
  private failures = 0;
  private openedAt: number | null = null;
  private probeActive = false;
  private readonly failureThreshold: number;
  private readonly resetMs: number;
  private readonly now: () => number;

  constructor(
    private readonly config: TermsAccessConfig,
    options: TermsCircuitOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetMs = options.resetMs ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  async decide(command: TermsAccessCommand): Promise<TermsAccessDecision> {
    const halfOpen = this.openedAt !== null && this.now() - this.openedAt >= this.resetMs;
    if (this.openedAt !== null && !halfOpen) {
      throw new TermsAccessClientError("TERMS_ACCESS_CIRCUIT_OPEN");
    }
    if (halfOpen && this.probeActive) {
      throw new TermsAccessClientError("TERMS_ACCESS_CIRCUIT_OPEN");
    }
    if (halfOpen) this.probeActive = true;

    try {
      const decision = await this.requestDecision(command);
      this.failures = 0;
      this.openedAt = null;
      return decision;
    } catch (error) {
      this.failures += 1;
      if (halfOpen || this.failures >= this.failureThreshold) this.openedAt = this.now();
      throw error;
    } finally {
      if (halfOpen) this.probeActive = false;
    }
  }

  private async requestDecision(command: TermsAccessCommand): Promise<TermsAccessDecision> {
    let response: Response;
    try {
      response = await fetch(
        `${this.config.baseUrl.replace(/\/$/, "")}/internal/v1/access-decisions`,
        {
          method: "POST",
          headers: {
            Authorization: command.authorization,
            "X-Service-Token": this.config.token,
            "X-Request-Id": command.requestId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resourceClass: "credit_business" }),
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );
    } catch (error) {
      throw new TermsAccessClientError(
        error instanceof DOMException && error.name === "TimeoutError"
          ? "TERMS_ACCESS_TIMEOUT"
          : "TERMS_ACCESS_UNAVAILABLE",
      );
    }
    if (!response.ok) {
      throw new TermsAccessClientError("TERMS_ACCESS_UNAVAILABLE");
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new TermsAccessClientError("TERMS_ACCESS_RESPONSE_INVALID");
    }
    const parsed = decisionSchema.safeParse(raw);
    if (!parsed.success) {
      throw new TermsAccessClientError("TERMS_ACCESS_RESPONSE_INVALID");
    }
    return parsed.data;
  }
}
