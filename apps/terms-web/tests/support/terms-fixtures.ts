import { Page } from '@playwright/test';

export const termsVersion = {
  versionId: '00000000-0000-4000-8000-000000000101',
  versionCode: 'TERMS-2026-01',
  title: 'Términos y condiciones',
  contentSha256: 'a'.repeat(64),
  state: 'EFFECTIVE',
  effectiveAt: '2026-08-12T00:00:00.000Z',
  publishedAt: '2026-08-01T00:00:00.000Z',
  contentFormat: 'markdown',
  content: '# Uso del servicio\n\nTexto legal sintético.\n\n## Responsabilidades\n\n- Leer el documento\n- Aceptar explícitamente',
};

export async function mockPendingTerms(page: Page, options: { changed?: boolean; delay?: number } = {}) {
  await page.route('**/terms-api/v1/current', async (route) => {
    if (options.delay) await new Promise((resolve) => setTimeout(resolve, options.delay));
    await route.fulfill({ json: { version: termsVersion, acceptanceStatus: 'PENDING', acceptedAt: null } });
  });
  await page.route('**/terms-api/v1/acceptances', async (route) => {
    if (options.changed) {
      await route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({
        type: 'about:blank', title: 'La versión vigente cambió', status: 409,
        code: 'TERMS_VERSION_CHANGED', retryable: true,
      }) });
      return;
    }
    await route.fulfill({ status: 201, json: {
      acceptanceId: '00000000-0000-4000-8000-000000000201',
      versionId: termsVersion.versionId,
      versionCode: termsVersion.versionCode,
      acceptedAt: '2026-08-12T12:00:00.000Z',
      contentSha256: termsVersion.contentSha256,
    } });
  });
}
