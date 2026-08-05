import type pg from "pg";
import {
  HISTORY_PAGE_SIZE,
  type EvaluationHistoryItem,
  type HistoryScope,
  type HistorySearchFilters,
} from "./history.models.js";

interface HistoryRow extends pg.QueryResultRow {
  public_id: string;
  completed_at: Date;
  document_masked: string;
  applicant_display_name: string;
  score: number | null;
  risk_band: "riesgo_bajo" | "riesgo_medio" | "riesgo_alto" | null;
  status: "evaluada" | "revision_manual" | "error";
}

export class HistoryRepository {
  constructor(private readonly pool: pg.Pool) {}

  async search(
    scope: HistoryScope,
    filters: HistorySearchFilters,
  ): Promise<{ items: readonly EvaluationHistoryItem[]; totalItems: number }> {
    const values: unknown[] = [scope.orgId, filters.states];
    const predicates = ["org_scope_id=$1", "status=ANY($2::varchar[])"];

    if (scope.ownerActorId) {
      values.push(scope.ownerActorId);
      predicates.push(`owner_actor_id=$${String(values.length)}`);
    }
    if (filters.evaluationId) {
      values.push(filters.evaluationId);
      predicates.push(`public_id=$${String(values.length)}::uuid`);
    }
    if (filters.documentBlindIndex) {
      values.push(filters.documentBlindIndex);
      predicates.push(`document_blind_index=$${String(values.length)}`);
    }
    if (filters.dateFrom) {
      values.push(filters.dateFrom);
      predicates.push(
        `completed_at >= ($${String(values.length)}::date::timestamp AT TIME ZONE 'America/Bogota')`,
      );
    }
    if (filters.dateTo) {
      values.push(filters.dateTo);
      predicates.push(
        `completed_at < (($${String(values.length)}::date + 1)::timestamp AT TIME ZONE 'America/Bogota')`,
      );
    }

    const where = predicates.join(" AND ");
    const count = await this.pool.query<{ total: string }>(
      `SELECT count(*)::text total FROM scoring.evaluations WHERE ${where}`,
      values,
    );
    values.push(HISTORY_PAGE_SIZE, (filters.page - 1) * HISTORY_PAGE_SIZE);
    const rows = await this.pool.query<HistoryRow>(
      `SELECT public_id,completed_at,document_masked,applicant_display_name,score,risk_band,status FROM scoring.evaluations WHERE ${where} ORDER BY completed_at DESC,id DESC LIMIT $${String(values.length - 1)} OFFSET $${String(values.length)}`,
      values,
    );

    return {
      totalItems: Number(count.rows[0]?.total ?? 0),
      items: rows.rows.map((row) => ({
        evaluationId: row.public_id,
        completedAt: row.completed_at,
        timezone: "America/Bogota",
        documentMasked: row.document_masked,
        displayName: row.applicant_display_name,
        score: row.score,
        riskBand: row.risk_band,
        state: row.status,
      })),
    };
  }
}
