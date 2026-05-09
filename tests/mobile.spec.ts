import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile: stacks single-column with mobile layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mobile-layout')).toBeVisible();
});

test('mobile: TopBar shows only brand + LIVE', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('PATHWATCH').first()).toBeVisible();
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
  // OPS CONSOLE / SCOPE / UTC / RISK should not be visible at mobile viewport.
  // (They exist in the DOM behind `hidden lg:inline` / `hidden lg:flex`; check
  // they have a 0x0 layout via boundingBox.)
  const header = page.locator('header').first();
  const headerText = await header.evaluate((el) => (el as HTMLElement).innerText);
  expect(headerText).not.toContain('SCOPE GLOBAL');
  expect(headerText).not.toContain('OPS CONSOLE');
  expect(headerText).not.toMatch(/UTC \d{4}-/);
  expect(headerText).not.toMatch(/^RISK /);
});

test('mobile: map collapse toggle hides + shows map', async ({ page }) => {
  await page.goto('/');
  // Default: open. Click Hide Map.
  const hideBtn = page.getByRole('button', { name: /Hide Map/ });
  await expect(hideBtn).toBeVisible();
  await hideBtn.click();
  await expect(page.getByRole('button', { name: /Show Map/ })).toBeVisible();
  // Re-open.
  await page.getByRole('button', { name: /Show Map/ }).click();
  await expect(page.getByRole('button', { name: /Hide Map/ })).toBeVisible();
});

test('mobile: case selection opens bottom sheet, close dismisses', async ({ page }) => {
  await page.goto('/?case=MVH-001');
  const sheet = page.getByTestId('dossier-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'MVH-001' })).toBeVisible();
  // Close via X button.
  await sheet.getByRole('button', { name: 'Close dossier' }).click();
  await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
  await expect(sheet).toBeHidden();
});

test('mobile: country posture renders as cards (not table)', async ({ page }) => {
  await page.goto('/');
  const mobile = page.getByTestId('mobile-layout');
  await mobile.getByText('COUNTRIES AFFECTED').scrollIntoViewIfNeeded();
  await expect(mobile.getByText('COUNTRIES AFFECTED')).toBeVisible();
  // Card list shows CASES n / DEATHS n.
  await expect(mobile.getByText(/CASES \d+/).first()).toBeVisible();
});
