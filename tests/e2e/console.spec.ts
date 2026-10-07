import { expect, test, type Page } from '@playwright/test';
import { TEST_VIEWER, addPass } from './pass';

const pickTicket = (page: Page, subject: string) =>
  page.getByRole('region', { name: 'Inbox' }).getByRole('button', { name: new RegExp(subject) }).click();

const ticket = (page: Page) => page.getByRole('region', { name: 'Ticket' });
const decision = (page: Page) => page.getByRole('region', { name: 'Your decision' });

test.beforeEach(async ({ context, baseURL }) => addPass(context, baseURL!));

test('ticket 1: the refund rule stops the agent, and approving shows what would happen', async ({ page }) => {
  await page.goto('/');
  await pickTicket(page, 'Charged twice this month');
  await expect(ticket(page).getByText('Classified the ticket')).toBeVisible();
  await expect(decision(page).getByText('Needs your approval')).toBeVisible({ timeout: 15_000 });
  await expect(decision(page).getByText('Refund rule')).toBeVisible();
  await expect(ticket(page).getByText('Ran the safety rules')).toBeVisible();
  await decision(page).getByRole('button', { name: 'Approve and send' }).click();
  await expect(decision(page).getByText('Reply approved for maya@example.com.')).toBeVisible();
});

test('ticket 3: a how-to question is ready to send', async ({ page }) => {
  await page.goto('/');
  await pickTicket(page, 'How do I export to CSV?');
  await expect(decision(page).getByText('Ready to send')).toBeVisible({ timeout: 15_000 });
});

test('ticket 4: a possible outage is escalated to Engineering', async ({ page }) => {
  await page.goto('/');
  await pickTicket(page, 'Your API is down!!');
  await expect(decision(page).getByText('Escalated to Engineering')).toBeVisible({ timeout: 15_000 });
});

test('the raw tool call is one click away for technical visitors', async ({ page }) => {
  await page.goto('/');
  await expect(decision(page).getByText('Needs your approval')).toBeVisible({ timeout: 15_000 });
  await ticket(page).getByRole('button', { name: 'View tool call' }).first().click();
  await expect(ticket(page).getByText(/classify_ticket\(/)).toBeVisible();
});

for (const size of [
  { width: 820, height: 1600 },
  { width: 400, height: 2400 },
]) {
  test(`panes sit close together with no stretched gaps at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size); // taller than the content, so stretched rows would show
    await page.goto('/');
    await expect(decision(page).getByText('Needs your approval')).toBeVisible({ timeout: 15_000 });
    const [inbox, run, dec] = await Promise.all(
      ['Inbox', 'Ticket', 'Your decision'].map(async (name) => (await page.getByRole('region', { name }).boundingBox())!),
    );
    const bottom = (b: { y: number; height: number }) => b.y + b.height;
    if (run.y > inbox.y + 1) expect(run.y - bottom(inbox)).toBeLessThanOrEqual(32);
    expect(dec.y - Math.max(bottom(inbox), bottom(run))).toBeLessThanOrEqual(32);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
}

test('the accuracy page is one click from the console', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Accuracy' }).click();
  await expect(page.getByRole('heading', { name: 'How accurate is it?' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the demo' })).toBeVisible();
});

test('a live run past the daily allowance falls back to the recording and says why', async ({ page }) => {
  await page.route('**/api/run', (route) => route.fulfill({ status: 429, body: '' }));
  await page.goto('/');
  await expect(decision(page).getByText('Needs your approval')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Run live' }).click();
  await expect(page.getByText("You've used today's live runs. Showing the recorded run.")).toBeVisible();
  await expect(decision(page).getByText('Needs your approval')).toBeVisible({ timeout: 15_000 });
});

test('an expired pass during a live run goes through the hub and comes back to the same ticket', async ({ page }) => {
  await page.route('**/api/run', (route) => route.fulfill({ status: 401, body: '' }));
  await page.route('http://localhost:3100/**', (route) => route.fulfill({ status: 200, body: 'hub' }));
  await page.goto('/');
  await pickTicket(page, 'Your API is down!!');
  await page.getByRole('button', { name: 'Run live' }).click();
  await page.waitForURL(/localhost:3100\/renew\?next=/);
  expect(decodeURIComponent(page.url())).toContain('ticket=t4');
});

test('the shared top bar names the viewer and links back to the projects', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('banner');
  await expect(bar.getByText(`Signed in as ${TEST_VIEWER}`)).toBeVisible();
  await expect(bar.getByRole('navigation', { name: 'Workspace' }).getByRole('link')).toHaveText(['Ticket triage agent', 'QA agent', 'Digital Twin Studio']);
  await expect(bar.getByRole('link', { name: 'Ticket triage agent' })).toHaveAttribute('aria-current', 'page');
  await expect(bar.getByRole('link', { name: 'Luv Wadhwani' })).toHaveAttribute('href', 'http://localhost:3100/');
  await expect(bar.getByRole('link', { name: 'Admin' })).toHaveCount(0);
});

test("a prospect can't make the Admin link appear by sending the admin header themselves", async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-lw-admin': '1' });
  await page.goto('/');
  const bar = page.getByRole('banner');
  await expect(bar.getByText(`Signed in as ${TEST_VIEWER}`)).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Admin' })).toHaveCount(0);
});

test('each page has one banner landmark, the shared top bar', async ({ page }) => {
  for (const path of ['/', '/evals']) {
    await page.goto(path);
    await expect(page.getByRole('banner')).toHaveCount(1);
  }
});

test('the colour switch is remembered across a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('without a pass, pages go to the hub and live runs are refused', async ({ request }) => {
  const page = await request.get('/', { maxRedirects: 0 });
  expect(page.status()).toBe(307);
  expect(page.headers().location).toMatch(/^http:\/\/localhost:3100\/renew\?next=http%3A%2F%2Flocalhost%3A3000%2F/);
  const run = await request.post('/api/run', { data: { ticketId: 't1' }, maxRedirects: 0 });
  expect(run.status()).toBe(401);
});
