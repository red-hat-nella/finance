import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { requestContext } from "../../src/http/middleware/request-context.js";
import {
  createApplicationController,
  getApplicationController,
  updateApplicationController,
} from "../../src/modules/applications/application.controller.js";
import type {
  ApplicationResource,
  ApplicationService,
} from "../../src/modules/applications/application.service.js";
import { evaluateApplicationController } from "../../src/modules/evaluations/evaluation.controller.js";
import type { EvaluateApplicationService } from "../../src/modules/evaluations/evaluate-application.service.js";

const applicationId = "10000000-0000-4000-8000-000000000001";
const body: ApplicationResource = {
  applicationId,
  state: "borrador",
  revisionNumber: 1,
  lockVersion: 1,
  createdAt: "2026-08-04T14:00:00.000Z",
  updatedAt: "2026-08-04T14:00:00.000Z",
  draftExpiresAt: "2026-11-02T14:00:00.000Z",
  applicant: {
    documentType: "CC",
    documentNumber: "102341032",
    documentMasked: "CC ••••••1032",
    fullName: "María Paula Rojas",
    displayName: "María R.",
    contact: { phone: "+573001112233" },
  },
};

function testApp(service: ApplicationService) {
  const app = express();
  app.use(requestContext);
  app.use(
    express.json({
      type: ["application/json", "application/merge-patch+json"],
    }),
  );
  app.use((req, _res, next) => {
    req.actor = {
      actorId: "analyst-contract",
      orgId: "org-contract",
      roles: ["credit_analyst"],
    };
    next();
  });
  app.post("/api/v1/applications", createApplicationController(service));
  app.get(
    "/api/v1/applications/:applicationId",
    getApplicationController(service),
  );
  app.patch(
    "/api/v1/applications/:applicationId",
    updateApplicationController(service),
  );
  return app;
}

function evaluationTestApp(service: EvaluateApplicationService) {
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = {
      actorId: "analyst-contract",
      orgId: "org-contract",
      roles: ["credit_analyst"],
    };
    next();
  });
  app.post(
    "/api/v1/applications/:applicationId/evaluations",
    evaluateApplicationController(service),
  );
  return app;
}

describe("US1 public application producer contract", () => {
  it("returns create Location, ETag, request ID and idempotency replay", async () => {
    const service = {
      create: vi.fn().mockResolvedValue({
        body,
        status: 201,
        etag: '"1"',
        location: `/api/v1/applications/${applicationId}`,
        replayed: true,
      }),
    } as unknown as ApplicationService;
    const response = await request(testApp(service))
      .post("/api/v1/applications")
      .set("Idempotency-Key", "d64ccfd5-2e3c-4e44-b28f-abfa7c117001")
      .send({ applicant: body.applicant })
      .expect(201);

    expect(response.headers["etag"]).toBe('"1"');
    expect(response.headers["location"]).toBe(
      `/api/v1/applications/${applicationId}`,
    );
    expect(response.headers["idempotency-replayed"]).toBe("true");
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body).toEqual(body);
  });

  it("returns a draft and accepts merge-patch with If-Match", async () => {
    const get = vi.fn().mockResolvedValue({ body, status: 200, etag: '"1"' });
    const update = vi.fn().mockResolvedValue({
      body: { ...body, lockVersion: 2 },
      status: 200,
      etag: '"2"',
    });
    const service = { get, update } as unknown as ApplicationService;
    await request(testApp(service))
      .get(`/api/v1/applications/${applicationId}`)
      .expect("ETag", '"1"')
      .expect(200, body);

    const response = await request(testApp(service))
      .patch(`/api/v1/applications/${applicationId}`)
      .set("Content-Type", "application/merge-patch+json")
      .set("If-Match", '"1"')
      .send({ consent: { decision: "denied" } })
      .expect(200);
    expect(response.headers["etag"]).toBe('"2"');
    expect(update).toHaveBeenCalledWith(
      applicationId,
      { consent: { decision: "denied" } },
      '"1"',
      expect.objectContaining({ actorId: "analyst-contract" }),
      expect.any(String),
    );
  });

  it("rejects a missing or malformed idempotency key before the service", async () => {
    const create = vi.fn();
    const service = { create } as unknown as ApplicationService;
    await request(testApp(service))
      .post("/api/v1/applications")
      .send({ applicant: body.applicant })
      .expect(400);
    await request(testApp(service))
      .post("/api/v1/applications")
      .set("Idempotency-Key", "not-a-uuid")
      .send({ applicant: body.applicant })
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns contractual evaluation Location and replay headers", async () => {
    const evaluationId = "20000000-0000-4000-8000-000000000001";
    const execute = vi.fn().mockResolvedValue({
      status: 201,
      body: { evaluationId, state: "evaluada", score: 835 },
      location: `/api/v1/evaluations/${evaluationId}`,
      replayed: true,
    });
    const response = await request(
      evaluationTestApp({ execute } as unknown as EvaluateApplicationService),
    )
      .post(`/api/v1/applications/${applicationId}/evaluations`)
      .set("Idempotency-Key", "d64ccfd5-2e3c-4e44-b28f-abfa7c117002")
      .set("If-Match", '"1"')
      .send({
        revisionNumber: 1,
        expectedCriteriaVersion: "SCORING-MVP-1.0.0",
      })
      .expect(201);

    expect(response.headers["location"]).toBe(
      `/api/v1/evaluations/${evaluationId}`,
    );
    expect(response.headers["idempotency-replayed"]).toBe("true");
    expect(execute).toHaveBeenCalledWith(
      applicationId,
      expect.any(Object),
      '"1"',
      "d64ccfd5-2e3c-4e44-b28f-abfa7c117002",
      expect.objectContaining({ actorId: "analyst-contract" }),
      expect.any(String),
    );
  });

  it("requires If-Match before starting an evaluation", async () => {
    const execute = vi.fn();
    await request(
      evaluationTestApp({ execute } as unknown as EvaluateApplicationService),
    )
      .post(`/api/v1/applications/${applicationId}/evaluations`)
      .set("Idempotency-Key", "d64ccfd5-2e3c-4e44-b28f-abfa7c117003")
      .send({
        revisionNumber: 1,
        expectedCriteriaVersion: "SCORING-MVP-1.0.0",
      })
      .expect(412);
    expect(execute).not.toHaveBeenCalled();
  });
});
