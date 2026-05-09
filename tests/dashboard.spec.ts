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

test('intelligence feed renders with 6 tabs and signal warning', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('INTELLIGENCE FEED')).toBeVisible();
  // 6 tabs
  for (const label of ['ALL', 'CASES', 'OFFICIAL', 'RESPONSE', 'SCIENCE', 'SIGNAL']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}\\b`) })).toBeVisible();
  }
  // Default tab = ALL: at least one card visible
  const eventLinks = page.locator('a[href^="/event/"]');
  await expect(eventLinks.first()).toBeVisible();
  // Signal tab activates the warning banner
  await page.getByRole('button', { name: /^SIGNAL\b/ }).click();
  await expect(page.getByText('UNVERIFIED SOCIAL MEDIA SIGNAL')).toBeVisible();
});

test('virus profile card renders hero CFR + stat grid + expand', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Virus Profile' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Virus Profile' })).toBeVisible();
  // Metadata strip
  await expect(page.getByText(/FACTS INDEXED/)).toBeVisible();
  // Hero CFR label + at least one zone label
  await expect(page.getByText('Case fatality rate')).toBeVisible();
  await expect(page.getByText('SEVERE', { exact: true })).toBeVisible();
  // Stat grid labels (sentence case)
  await expect(page.getByText('R₀', { exact: true })).toBeVisible();
  await expect(page.getByText('Incubation', { exact: true })).toBeVisible();
  await expect(page.getByText('Reservoir', { exact: true })).toBeVisible();
  await expect(page.getByText('Transmission', { exact: true })).toBeVisible();
  await expect(page.getByText('Strain', { exact: true })).toBeVisible();
  // Expand reveals categorized list
  await page.getByRole('button', { name: /Expand/i }).last().click();
  await expect(page.getByRole('heading', { name: /PATHOGEN/ })).toBeVisible();
});

test('/facts renders the knowledge base', async ({ page }) => {
  await page.goto('/facts');
  await expect(page.getByRole('heading', { name: 'KNOWLEDGE BASE' })).toBeVisible();
  await expect(page.getByText(/Andes orthohantavirus/i).first()).toBeVisible();
  // Verify a CONFIRMED VerificationBadge (visible span, not the hidden <option> in the dropdown)
  await expect(page.locator('span').filter({ hasText: /^CONFIRMED$/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'pathogen' })).toBeVisible();
});

test('monitoring cohort renders with countdown chips', async ({ page }) => {
  await page.goto('/');
  // Cohort is below the fold in the sit-rep column — scroll first.
  await page.getByText('NJ-MON-001').scrollIntoViewIfNeeded();
  await expect(page.getByText('NJ-MON-001')).toBeVisible();
  await expect(page.getByText('NJ-MON-002')).toBeVisible();
  await expect(page.getByText('KL592-MON-001')).toBeVisible();
  await expect(page.getByText('KL592-MON-002')).toBeVisible();
  await expect(page.getByText(/4 TOTAL/)).toBeVisible();
  await expect(page.getByText(/^[0-9]+D$/).first()).toBeVisible();
});

test('threat banner renders + expands', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('PANDEMIC PROBABILITY')).toBeVisible();
  await expect(page.getByText(/vs MARKET/i)).toBeVisible();
  // Threat-level chip from seed: LOW
  await expect(page.locator('button[aria-expanded="false"]').filter({ hasText: 'PANDEMIC PROBABILITY' }).getByText('LOW', { exact: true })).toBeVisible();
  // Expand
  const expandButton = page.locator('button[aria-expanded="false"]').filter({ hasText: 'PANDEMIC PROBABILITY' });
  await expandButton.click();
  await expect(page.getByText('TRIGGERS', { exact: true })).toBeVisible();
  await expect(page.getByText(/WATCHING ·/).first()).toBeVisible();
  await expect(page.getByText('POLYMARKET', { exact: true })).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
