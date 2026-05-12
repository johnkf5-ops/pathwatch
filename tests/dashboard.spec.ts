import { test, expect } from '@playwright/test';

// Tests run at default Desktop Chrome viewport (1280x720), so the desktop
// layout is visible. The mobile layout is also rendered into the DOM behind
// `lg:hidden`, so most queries must scope to `getByTestId('desktop-layout')`
// to avoid strict-mode violations across duplicate text.

test('ops console renders sit-rep + tabs', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  await expect(page.getByText('PATHWATCH').first()).toBeVisible();
  await expect(desktop.getByText('SITUATION BRIEF')).toBeVisible();
  await expect(desktop.getByText('KEY METRICS')).toBeVisible();
  await expect(desktop.getByText('COUNTRIES AFFECTED')).toBeVisible();
  await expect(desktop.getByText('WATCHLIST')).toBeVisible();
  // CASES chip in TopBar (desktop-only, lg:flex on the right side of the header).
  // Seed: 6 confirmed_case + 4 suspected_case = 10. Pre-Task-8 this still reads
  // snapshot.total_cases (8) but Task 8 swaps it to a derived count (10).
  await expect(page.getByText(/CASES\s+\d+/).first()).toBeVisible();
  await expect(desktop.getByRole('tab', { name: /MAP/ })).toBeVisible();
  await expect(desktop.getByRole('tab', { name: /BY COUNTRY/ })).toBeVisible();
});

test('MonitoringCohort has ALL/CONTACTS/RETURNEES filter chips', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  const monitoring = desktop.getByText('MONITORING', { exact: true }).locator('xpath=ancestor::section[1]');
  await expect(monitoring.getByRole('button', { name: 'ALL' })).toBeVisible();
  await expect(monitoring.getByRole('button', { name: 'CONTACTS' })).toBeVisible();
  await expect(monitoring.getByRole('button', { name: 'RETURNEES' })).toBeVisible();
  // Default ALL: 4 rows visible (4 contacts in seed).
  await expect(monitoring.getByText('NJ-MON-001')).toBeVisible();
  await expect(monitoring.getByText('KL592-MON-001')).toBeVisible();
  // Click RETURNEES: list becomes empty (no returnees in seed).
  await monitoring.getByRole('button', { name: 'RETURNEES' }).click();
  await expect(monitoring.getByText('NJ-MON-001')).toHaveCount(0);
  // Click CONTACTS: 4 contacts visible again.
  await monitoring.getByRole('button', { name: 'CONTACTS' }).click();
  await expect(monitoring.getByText('NJ-MON-001')).toBeVisible();
});

test('TopBar CASES chip uses case_class-derived count', async ({ page }) => {
  await page.goto('/');
  // Topbar chip is in <header>, hidden on mobile (lg:flex). Default test viewport
  // is desktop (1280x720). Seed: 6 confirmed_case + 4 suspected_case = 10.
  const header = page.locator('header').first();
  await expect(header.getByText(/CASES\s+10/)).toBeVisible();
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
  // Two "DOSSIER" strings live in the drawer: the breadcrumb span ("DOSSIER · MVH-001")
  // and the section heading. Scope to the heading to avoid a strict-mode collision.
  await expect(desktop.getByRole('heading', { name: 'DOSSIER' })).toBeVisible();
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
  // Scope to the EventFeed section. MonitoringCohort also has an "ALL" button
  // so unscoped getByRole('button', { name: 'ALL' }) is now ambiguous.
  const feed = desktop
    .getByRole('heading', { name: /INTELLIGENCE FEED/ })
    .locator('xpath=ancestor::section[1]');
  await expect(feed).toBeVisible();
  for (const label of ['ALL', 'CASES', 'OFFICIAL', 'RESPONSE', 'SCIENCE', 'SIGNAL']) {
    await expect(feed.getByRole('button', { name: new RegExp(`^${label}\\b`) })).toBeVisible();
  }
  // Default tab = ALL: at least one card visible
  await expect(feed.locator('a[href^="/event/"]').first()).toBeVisible();
  // Signal tab activates the warning banner
  await feed.getByRole('button', { name: /^SIGNAL\b/ }).click();
  await expect(feed.getByText('UNVERIFIED SOCIAL MEDIA SIGNAL')).toBeVisible();
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

test('threat panel renders inline (assessment + KEY SIGNALS + POLYMARKET)', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  // ThreatPanelExpanded is always-rendered now (no expand button). The
  // "PANDEMIC PROBABILITY" chip moved to the TopBar; inside the desktop
  // grid the panel exposes ASSESSMENT/KEY SIGNALS/POLYMARKET subsections.
  await expect(desktop.getByText(/ASSESSMENT ·/)).toBeVisible();
  await expect(desktop.getByText('KEY SIGNALS', { exact: true })).toBeVisible();
  await expect(desktop.getByText('POLYMARKET', { exact: true })).toBeVisible();
  await expect(desktop.getByText('Pandemic 2026', { exact: true })).toBeVisible();
});

test('smoke: CASES displayed = sum of case_class IN (confirmed,probable,suspected)', async ({ page }) => {
  await page.goto('/');
  // Topbar chip (desktop, lg:flex). Pattern: "CASES <number>".
  const header = page.locator('header').first();
  const topbarChip = header.getByText(/CASES\s+\d+/);
  await expect(topbarChip).toBeVisible();
  const topbarText = (await topbarChip.textContent()) ?? '';
  const topbarCount = Number(topbarText.replace(/\D/g, ''));

  // Mobile KPI tile is rendered in DOM but visually hidden on desktop viewport.
  await expect(page.getByTestId('kpi-cases')).toContainText(String(topbarCount));

  // Sanity: derived value should be 10 from seed (6 confirmed + 4 suspected).
  expect(topbarCount).toBe(10);
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
