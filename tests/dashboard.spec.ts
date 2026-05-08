import { test, expect } from '@playwright/test';

test('ops console renders sit-rep + tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('PATHWATCH').first()).toBeVisible();
  await expect(page.getByText('OPS CONSOLE')).toBeVisible();
  await expect(page.getByText('SITUATION BRIEF')).toBeVisible();
  await expect(page.getByText('KEY METRICS')).toBeVisible();
  await expect(page.getByText('REGIONAL POSTURE')).toBeVisible();
  await expect(page.getByText('WATCHLIST')).toBeVisible();
  await expect(page.getByTestId('kpi-cases')).toContainText('8');
  await expect(page.getByRole('tab', { name: /MAP/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /BY COUNTRY/ })).toBeVisible();
});

test('case drilldown opens drawer', async ({ page }) => {
  await page.goto('/?case=MVH-001');
  await expect(page.getByTestId('dossier-drawer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'MVH-001' })).toBeVisible();
  await expect(page.getByText('DOSSIER')).toBeVisible();
  await expect(page.getByText(/birdwatching/i).first()).toBeVisible();
  await expect(page.getByText('TRAVEL TIMELINE')).toBeVisible();
});

test('case permalink page', async ({ page }) => {
  await page.goto('/case/MVH-001');
  await expect(page.getByRole('heading', { name: 'MVH-001' })).toBeVisible();
  await expect(page.getByText(/Dutch retiree/i)).toBeVisible();
  await expect(page.getByText('← BACK TO DASHBOARD')).toBeVisible();
});

test('event detail page renders', async ({ page }) => {
  // Reach the event detail page via the case permalink's "Linked event" link.
  // The Watchlist click flow is age-sensitive (24h window) and gets flaky as
  // seed timestamps drift past today's window; this is a stable surrogate.
  await page.goto('/case/MVH-001');
  await page.getByText(/LINKED EVENT/i).waitFor({ state: 'visible' });
  const linkedEvent = page.getByRole('link', { name: /↗/ }).first();
  await linkedEvent.click();
  await expect(page).toHaveURL(/\/event\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('/facts renders the knowledge base', async ({ page }) => {
  await page.goto('/facts');
  await expect(page.getByRole('heading', { name: 'KNOWLEDGE BASE' })).toBeVisible();
  await expect(page.getByText(/Andes orthohantavirus/i).first()).toBeVisible();
  // Verify a CONFIRMED VerificationBadge (visible span, not the hidden <option> in the dropdown)
  await expect(page.locator('span').filter({ hasText: /^CONFIRMED$/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'pathogen' })).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
