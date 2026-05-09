import { test, expect } from '@playwright/test';

// Tests run at default Desktop Chrome viewport (1280x720), so the desktop
// layout is visible. The mobile layout is also rendered into the DOM behind
// `lg:hidden`, so most queries must scope to `getByTestId('desktop-layout')`
// to avoid strict-mode violations across duplicate text.

test('ops console renders sit-rep + tabs', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  await expect(page.getByText('PATHWATCH').first()).toBeVisible();
  await expect(page.getByText('OPS CONSOLE')).toBeVisible();
  await expect(desktop.getByText('SITUATION BRIEF')).toBeVisible();
  await expect(desktop.getByText('KEY METRICS')).toBeVisible();
  await expect(desktop.getByText('COUNTRIES AFFECTED')).toBeVisible();
  await expect(desktop.getByText('WATCHLIST')).toBeVisible();
  await expect(desktop.getByTestId('kpi-cases')).toContainText('8');
  await expect(desktop.getByRole('tab', { name: /MAP/ })).toBeVisible();
  await expect(desktop.getByRole('tab', { name: /BY COUNTRY/ })).toBeVisible();
});

test('KPI HUD shows CASES (derived) and CONTACTS (no longer TRACKED)', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  const hud = desktop.getByText('KEY METRICS').locator('xpath=ancestor::div[contains(@class,"absolute")]');
  await expect(hud.getByText('CASES', { exact: true })).toBeVisible();
  await expect(hud.getByText('CONTACTS', { exact: true })).toBeVisible();
  await expect(hud.getByText('TRACKED', { exact: true })).toHaveCount(0);
  // Seed: 6 confirmed_case + 4 suspected_case = 10 cases; 4 contacts.
  await expect(hud.getByText(/CASES.*10/)).toBeVisible();
  await expect(hud.getByText(/CONTACTS.*4/)).toBeVisible();
});

test('case drilldown opens drawer', async ({ page }) => {
  await page.goto('/?case=MVH-001');
  const desktop = page.getByTestId('desktop-layout');
  await expect(desktop.getByTestId('dossier-drawer')).toBeVisible();
  await expect(desktop.getByRole('heading', { name: 'MVH-001' })).toBeVisible();
  await expect(desktop.getByText('DOSSIER')).toBeVisible();
  await expect(desktop.getByText(/birdwatching/i).first()).toBeVisible();
  await expect(desktop.getByText('TRAVEL TIMELINE')).toBeVisible();
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

test('intelligence feed renders with 6 tabs and signal warning', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  await expect(desktop.getByText('INTELLIGENCE FEED')).toBeVisible();
  // 6 tabs
  for (const label of ['ALL', 'CASES', 'OFFICIAL', 'RESPONSE', 'SCIENCE', 'SIGNAL']) {
    await expect(desktop.getByRole('button', { name: new RegExp(`^${label}\\b`) })).toBeVisible();
  }
  // Default tab = ALL: at least one card visible
  const eventLinks = desktop.locator('a[href^="/event/"]');
  await expect(eventLinks.first()).toBeVisible();
  // Signal tab activates the warning banner
  await desktop.getByRole('button', { name: /^SIGNAL\b/ }).click();
  await expect(desktop.getByText('UNVERIFIED SOCIAL MEDIA SIGNAL')).toBeVisible();
});

test('virus profile card renders 9 plain-language tiles + expand', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  await desktop.getByRole('heading', { name: 'Virus Profile' }).scrollIntoViewIfNeeded();
  await expect(desktop.getByRole('heading', { name: 'Virus Profile' })).toBeVisible();
  // Tile labels (plain English, sentence case)
  await expect(desktop.getByText('Virus', { exact: true })).toBeVisible();
  await expect(desktop.getByText('Virus family', { exact: true })).toBeVisible();
  await expect(desktop.getByText('Carried by', { exact: true })).toBeVisible();
  await expect(desktop.getByText('How it spreads', { exact: true })).toBeVisible();
  await expect(desktop.getByText('Fatality rate', { exact: true })).toBeVisible();
  await expect(desktop.getByText('Reproduction number', { exact: true })).toBeVisible();
  await expect(desktop.getByText('Incubation period', { exact: true })).toBeVisible();
  // Expand reveals categorized list
  await desktop.getByRole('button', { name: /Expand/i }).last().click();
  await expect(desktop.getByRole('heading', { name: /Pathogen/ })).toBeVisible();
});

test('/facts renders the knowledge base', async ({ page }) => {
  await page.goto('/facts');
  await expect(page.getByRole('heading', { name: 'KNOWLEDGE BASE' })).toBeVisible();
  await expect(page.getByText(/Andes orthohantavirus/i).first()).toBeVisible();
  await expect(page.locator('span').filter({ hasText: /^CONFIRMED$/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'pathogen' })).toBeVisible();
});

test('monitoring cohort renders with countdown chips', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  await desktop.getByText('NJ-MON-001').scrollIntoViewIfNeeded();
  await expect(desktop.getByText('NJ-MON-001')).toBeVisible();
  await expect(desktop.getByText('NJ-MON-002')).toBeVisible();
  await expect(desktop.getByText('KL592-MON-001')).toBeVisible();
  await expect(desktop.getByText('KL592-MON-002')).toBeVisible();
  await expect(desktop.getByText(/4 TOTAL/)).toBeVisible();
  await expect(desktop.getByText(/^[0-9]+D$/).first()).toBeVisible();
});

test('threat banner renders + expands', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  await expect(desktop.getByText('PANDEMIC PROBABILITY')).toBeVisible();
  await expect(desktop.getByText(/vs MARKET/i)).toBeVisible();
  await expect(desktop.locator('button[aria-expanded="false"]').filter({ hasText: 'PANDEMIC PROBABILITY' }).getByText('LOW', { exact: true })).toBeVisible();
  // Expand
  const expandButton = desktop.locator('button[aria-expanded="false"]').filter({ hasText: 'PANDEMIC PROBABILITY' });
  await expandButton.click();
  await expect(desktop.getByText('TRIGGERS', { exact: true })).toBeVisible();
  await expect(desktop.getByText(/WATCHING ·/).first()).toBeVisible();
  await expect(desktop.getByText('POLYMARKET', { exact: true })).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
