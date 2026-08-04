export const HISTORY_PAGE_SIZE = 25 as const;
export const TERMINAL_EVALUATION_STATES = [
  "evaluada",
  "revision_manual",
  "error",
] as const;

export type TerminalEvaluationState =
  (typeof TERMINAL_EVALUATION_STATES)[number];

export interface HistorySearchFilters {
  readonly page: number;
  readonly evaluationId?: string;
  readonly documentBlindIndex?: Buffer;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly states: readonly TerminalEvaluationState[];
}

export interface HistoryScope {
  readonly orgId: string;
  readonly ownerActorId?: string;
}

export interface EvaluationHistoryItem {
  readonly evaluationId: string;
  readonly completedAt: Date;
  readonly timezone: "America/Bogota";
  readonly documentMasked: string;
  readonly displayName: string;
  readonly score: number | null;
  readonly riskBand: "riesgo_bajo" | "riesgo_medio" | "riesgo_alto" | null;
  readonly state: TerminalEvaluationState;
}

export interface EvaluationHistoryPage {
  readonly items: readonly EvaluationHistoryItem[];
  readonly page: number;
  readonly pageSize: typeof HISTORY_PAGE_SIZE;
  readonly totalItems: number;
  readonly totalPages: number;
}
