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

  // MapLibre attribution control is the most reliable map presence assertion
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible({ timeout: 10_000 });

  // Source activity chart renders (data-testid on the wrapper card)
  await expect(page.getByTestId('source-activity-chart')).toBeVisible();

  // Single-snapshot seed → trend empty state
  await expect(page.getByText(/Need at least 2 snapshots/i)).toBeVisible();
});
