import { Page } from '@playwright/test';

export const draftVersion = {
  versionId: '00000000-0000-4000-8000-000000000301', versionCode: 'TERMS-2026-02',
  title: 'Actualización 2026', contentSha256: 'b'.repeat(64), state: 'DRAFT',
  effectiveAt: null, publishedAt: null, contentFormat: 'markdown',
  content: '# Alcance\n\nContenido legal sintético.\n\n- Condición uno',
};

export async function mockAdminApi(page: Page) {
  await page.route('**/terms-api/v1/admin/versions', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 201, json: draftVersion });
    else await route.fulfill({ json: { items: [draftVersion] } });
  });
  await page.route(`**/terms-api/v1/admin/versions/${draftVersion.versionId}`, (route) => route.fulfill({ json: draftVersion }));
  await page.route(`**/terms-api/v1/admin/versions/${draftVersion.versionId}/schedule`, (route) => route.fulfill({ json: {
    ...draftVersion, state: 'SCHEDULED', effectiveAt: '2026-09-01T12:00:00.000Z', publishedAt: '2026-08-12T12:00:00.000Z',
  } }));
  await page.route(`**/terms-api/v1/admin/versions/${draftVersion.versionId}/withdraw`, (route) => route.fulfill({ json: {
    ...draftVersion, state: 'WITHDRAWN',
  } }));
}
