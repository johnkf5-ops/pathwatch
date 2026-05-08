import { test, expect } from '@playwright/test';

test('dashboard renders MV Hondius outbreak data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Pathwatch').first()).toBeVisible();

  await expect(page.getByTestId('stat-cases')).toContainText('8');
  await expect(page.getByTestId('stat-deaths')).toContainText('3');
  await expect(page.getByTestId('stat-countries')).toContainText('5');
  await expect(page.getByTestId('stat-fatality')).toContainText(/3[78]/);
  await expect(page.getByTestId('risk-badge')).toContainText(/moderate/i);

  await expect(page.getByText(/MV Hondius/i).first()).toBeVisible();
  await expect(page.getByText('Argentina').first()).toBeVisible();
  await expect(page.getByText('Cape Verde').first()).toBeVisible();
});

test('map and charts render', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('source-activity-chart')).toBeVisible();
  await expect(page.getByText(/Need at least 2 snapshots/i)).toBeVisible();
});

test('event detail page renders', async ({ page }) => {
  await page.goto('/');
  // Click the first event-card link whose text contains "MV Hondius"
  // (avoids matching the AI analysis paragraph that mentions "MV Hondius cluster").
  await page.getByRole('link').filter({ hasText: /MV Hondius/i }).first().click();
  await expect(page).toHaveURL(/\/event\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { level: 1, name: /MV Hondius/i })).toBeVisible();
  await expect(page.getByText(/Back to dashboard/i).first()).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
