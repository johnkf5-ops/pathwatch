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
  await page.goto('/');
  // Click the first watchlist item that has MV Hondius in title
  const link = page.getByRole('link').filter({ hasText: /MV Hondius/i }).first();
  await link.click();
  await expect(page).toHaveURL(/\/event\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { level: 1, name: /MV Hondius/i })).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
