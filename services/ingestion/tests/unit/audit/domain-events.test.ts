import { describe, expect, it } from "vitest";
import {
  applicationCreatedEvent,
  applicationUpdatedEvent,
  consentRecordedEvent,
} from "../../../src/modules/applications/application-events.js";
import {
  evaluationCompletedEvent,
  evaluationStartedEvent,
} from "../../../src/modules/evaluations/evaluation-events.js";

const actor = {
  actorId: "analyst-001",
  orgId: "org-001",
  roles: ["credit_analyst"] as const,
};
const application = {
  actor,
  applicationId: "application-db-id",
  correlationId: "request-id",
  revisionNumber: 1,
};
const evaluation = {
  ...application,
  evaluationId: "evaluation-db-id",
  attemptNumber: 1,
  criteriaVersion: "SCORING-MVP-1.0.0",
};

describe("safe domain audit events", () => {
  it("records application and consent transitions without applicant data", () => {
    expect(applicationCreatedEvent(application).metadata).toEqual({
      revisionNumber: 1,
      fromStatus: null,
      toStatus: "borrador",
      state: "borrador",
    });
    expect(applicationUpdatedEvent(application).metadata).toMatchObject({
      fromStatus: "borrador",
      toStatus: "borrador",
    });
    expect(consentRecordedEvent(application, "accepted")).toMatchObject({
      type: "CONSENT_RECORDED",
      outcome: "success",
      metadata: { revisionNumber: 1, state: "accepted" },
    });
  });

  it.each(["riesgo_bajo", "riesgo_medio", "riesgo_alto"] as const)(
    "records a completed %s result with criteria and transition",
    (riskBand) => {
      expect(
        evaluationCompletedEvent(evaluation, {
          state: riskBand === "riesgo_medio" ? "revision_manual" : "evaluada",
          riskBand,
        }),
      ).toMatchObject({
        type: "EVALUATION_COMPLETED",
        metadata: {
          fromStatus: "evaluando",
          toStatus:
            riskBand === "riesgo_medio" ? "revision_manual" : "evaluada",
          riskBand,
          criteriaVersion: "SCORING-MVP-1.0.0",
        },
      });
    },
  );

  it("records evaluation start without accepting a PII payload", () => {
    const event = evaluationStartedEvent(evaluation);
    expect(event.metadata).toEqual({
      revisionNumber: 1,
      attemptNumber: 1,
      fromStatus: "borrador",
      toStatus: "evaluando",
      state: "evaluando",
      criteriaVersion: "SCORING-MVP-1.0.0",
    });
    expect(JSON.stringify(event)).not.toMatch(/document|fullName|phone|email/i);
  });
});
