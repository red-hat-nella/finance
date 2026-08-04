export type HistoryState = 'evaluada' | 'revision_manual' | 'error';
export type DocumentType = 'CC' | 'CE' | 'PPT' | 'PASSPORT';

export interface HistorySearchInput {
  readonly page: number;
  readonly evaluationId?: string;
  readonly applicantIdentifier?: Readonly<{
    documentType: DocumentType;
    documentNumber: string;
  }>;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly states?: readonly HistoryState[];
}

export interface EvaluationHistoryItem {
  readonly evaluationId: string;
  readonly completedAt: string;
  readonly timezone: 'America/Bogota';
  readonly documentMasked: string;
  readonly displayName: string;
  readonly score: number | null;
  readonly riskBand: 'riesgo_bajo' | 'riesgo_medio' | 'riesgo_alto' | null;
  readonly state: HistoryState;
}

export interface EvaluationHistoryPage {
  readonly items: readonly EvaluationHistoryItem[];
  readonly page: number;
  readonly pageSize: 25;
  readonly totalItems: number;
  readonly totalPages: number;
}

export const EMPTY_HISTORY_FILTERS: HistorySearchInput = Object.freeze({
  page: 1,
});
