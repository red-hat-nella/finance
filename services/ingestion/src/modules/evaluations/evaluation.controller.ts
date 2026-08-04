import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { sendProblem } from "../../http/problem.js";
import {
  EvaluationNotFoundError,
  type GetEvaluationDetailService,
} from "../history/get-evaluation-detail.service.js";

const evaluationIdSchema = z.uuid();
const dateTimeSchema = z.iso.datetime({ offset: true });
const unavailableDataSchema = z
  .object({
    availability: z.literal("unavailable"),
    reason: z.string().min(10).max(240),
  })
  .strict();
const utilityReferenceSchema = z
  .object({
    serviceType: z.enum(["electricity", "water", "gas", "internet", "other"]),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    observedMonths: z.number().int().min(1).max(12),
    totalObligations: z.number().int().min(1).max(12),
    onTimeCount: z.number().int().min(0).max(12),
    lateCount: z.number().int().min(0).max(12),
    missedCount: z.number().int().min(0).max(12),
    averageMonthlyAmountCop: z.string().regex(/^\d{1,10}\.\d{2}$/),
  })
  .strict();
const alternativeDataSchema = z
  .object({
    income: z.union([
      unavailableDataSchema,
      z
        .object({
          availability: z.literal("provided"),
          monthlyIncomeCop: z.string().regex(/^\d{1,10}\.\d{2}$/),
          sourceType: z.enum([
            "employment",
            "self_employed",
            "pension",
            "other",
          ]),
          sourceOtherDescription: z.string().min(3).max(80).optional(),
          stabilityMonths: z.number().int().min(0).max(600),
        })
        .strict(),
    ]),
    utilities: z.union([
      unavailableDataSchema,
      z
        .object({
          availability: z.literal("provided"),
          references: z.array(utilityReferenceSchema).min(1).max(3),
        })
        .strict(),
    ]),
    mobile: z.union([
      unavailableDataSchema,
      z
        .object({
          availability: z.literal("provided"),
          mode: z.enum(["prepaid", "postpaid"]),
          tenureMonths: z.number().int().min(0).max(600),
          observedMonths: z.number().int().min(1).max(12),
          regularMonths: z.number().int().min(0).max(12),
        })
        .strict(),
    ]),
  })
  .strict();
const inputSnapshotSchema = z
  .object({
    applicationId: z.uuid(),
    state: z.enum([
      "borrador",
      "evaluando",
      "evaluada",
      "revision_manual",
      "error",
    ]),
    revisionNumber: z.number().int().min(1),
    lockVersion: z.number().int().min(1),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    draftExpiresAt: dateTimeSchema.nullable(),
    applicant: z
      .object({
        documentType: z.enum(["CC", "CE", "PPT", "PASSPORT"]),
        documentNumber: z.string().min(3).max(20),
        documentMasked: z.string().max(24),
        fullName: z.string().min(3).max(120),
        displayName: z.string().max(64),
        contact: z
          .object({
            phone: z
              .string()
              .regex(/^\+?[0-9]{7,15}$/)
              .optional(),
            email: z.email().max(254).optional(),
          })
          .strict()
          .refine((contact) => contact.phone || contact.email),
      })
      .strict(),
    consent: z
      .object({
        decision: z.enum(["accepted", "denied", "revoked"]),
        noticeVersion: z.string().min(1).max(64),
        purposeCode: z.literal("ALTERNATIVE_CREDIT_RISK_EVALUATION"),
        recordedAt: dateTimeSchema,
      })
      .strict()
      .nullable(),
    alternativeData: alternativeDataSchema,
  })
  .strict();

export const evaluationDetailResponseSchema = z
  .object({
    evaluationId: z.uuid(),
    applicationId: z.uuid(),
    revisionNumber: z.number().int().min(1),
    attemptNumber: z.number().int().min(1),
    state: z.enum(["evaluando", "evaluada", "revision_manual", "error"]),
    score: z.number().int().min(300).max(850).nullable(),
    scoreScale: z
      .object({ minimum: z.literal(300), maximum: z.literal(850) })
      .strict(),
    riskBand: z.enum(["riesgo_bajo", "riesgo_medio", "riesgo_alto"]).nullable(),
    recommendation: z
      .object({
        code: z.enum([
          "CONTINUE_HUMAN_ANALYSIS",
          "MANUAL_REVIEW_REQUIRED",
          "DO_NOT_CONTINUE_WITHOUT_DOCUMENTED_HUMAN_DECISION",
        ]),
        text: z.string().min(1).max(240),
      })
      .strict()
      .nullable(),
    factors: z
      .array(
        z
          .object({
            rank: z.number().int().min(1).max(3),
            dimension: z.enum(["utility", "mobile", "income"]),
            direction: z.enum(["favorable", "unfavorable", "neutral"]),
            dimensionIndex: z.string().regex(/^[0-9]{1,3}\.[0-9]{3}$/),
            weight: z.string().regex(/^0\.[0-9]{3}$/),
            contributionPoints: z.string().regex(/^[0-9]{1,3}\.[0-9]{3}$/),
            observedSummary: z.string().min(1).max(240),
            ruleCode: z.string().min(1).max(64),
            explanation: z.string().min(1).max(320),
          })
          .strict(),
      )
      .max(3),
    manualReviewReasons: z.array(
      z
        .object({
          code: z.string().min(1).max(64),
          dimension: z.enum(["utility", "mobile", "income", "explanation"]),
          message: z.string().min(1).max(240),
        })
        .strict(),
    ),
    criteriaVersion: z.literal("SCORING-MVP-1.0.0"),
    inputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    startedAt: dateTimeSchema,
    completedAt: dateTimeSchema.nullable(),
    timezone: z.literal("America/Bogota"),
    applicantSummary: z
      .object({
        documentMasked: z.string().max(24),
        displayName: z.string().max(64),
      })
      .strict(),
    inputSnapshot: inputSnapshotSchema.nullable(),
    relatedAttempts: z.array(
      z
        .object({
          evaluationId: z.uuid(),
          attemptNumber: z.number().int().min(1),
          state: z.enum(["evaluando", "evaluada", "revision_manual", "error"]),
          startedAt: dateTimeSchema,
          completedAt: dateTimeSchema.nullable(),
          errorCode: z.string().max(64).nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export function getEvaluationController(service: GetEvaluationDetailService) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.actor;
      const evaluationId = evaluationIdSchema.safeParse(
        req.params.evaluationId,
      );
      if (!actor || !evaluationId.success) {
        sendNotFound(req, res);
        return;
      }
      const detail = evaluationDetailResponseSchema.parse(
        await service.execute(evaluationId.data, actor, req.requestId),
      );
      res.status(200).json(detail);
    } catch (error) {
      if (error instanceof EvaluationNotFoundError) {
        sendNotFound(req, res);
        return;
      }
      next(error);
    }
  };
}

function sendNotFound(req: Request, res: Response): void {
  sendProblem(req, res, {
    status: 404,
    title: "Evaluación no encontrada",
    detail: "No se encontró una evaluación accesible con ese identificador.",
    code: "EVALUATION_NOT_FOUND",
  });
}
