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
