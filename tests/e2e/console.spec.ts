import { expect, test, type Page } from '@playwright/test';

const pickTicket = (page: Page, subject: string) =>
  page.getByRole('region', { name: 'Inbox' }).getByRole('button', { name: new RegExp(subject) }).click();

const ticket = (page: Page) => page.getByRole('region', { name: 'Ticket' });
const decision = (page: Page) => page.getByRole('region', { name: 'Your decision' });

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

test('a rate-limited live run falls back to the recording and says why', async ({ page }) => {
  await page.route('**/api/run', (route) => route.fulfill({ status: 429, body: '' }));
  await page.goto('/');
  await expect(decision(page).getByText('Needs your approval')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Run live' }).click();
  await expect(page.getByText('Live runs are rate-limited (5 per day). Showing the recorded run instead.')).toBeVisible();
  await expect(decision(page).getByText('Needs your approval')).toBeVisible({ timeout: 15_000 });
});
