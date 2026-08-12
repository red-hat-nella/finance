import { Page } from '@playwright/test';

export const acceptanceEvidence = {
  acceptanceId: '00000000-0000-4000-8000-000000000401', versionId: '00000000-0000-4000-8000-000000000301',
  versionCode: 'TERMS-2026-01', acceptedAt: '2026-08-12T12:00:00Z', contentSha256: 'a'.repeat(64), actorDisplay: 'act***001',
};

export async function mockAudit(page: Page, status: 'results' | 'empty' | 'denied' | 'unavailable' = 'results') {
  await page.route('**/terms-api/v1/audit/acceptances/search', (route) => {
    if (status === 'denied') return route.fulfill({ status: 403, json: { code: 'FORBIDDEN', status: 403 } });
    if (status === 'unavailable') return route.fulfill({ status: 503, json: { code: 'TERMS_SERVICE_UNAVAILABLE', status: 503 } });
    return route.fulfill({ json: { items: status === 'empty' ? [] : [acceptanceEvidence], nextCursor: null } });
  });
}
