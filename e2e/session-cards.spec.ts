import { expect, type Page, test } from '@playwright/test';

/**
 * Session cards for the selected summer week (CAM-32). The unit suites cover
 * the card's facts and which cards a week shows; this covers what needs a real
 * browser: the week in the URL through reload and back/forward, and the card's
 * layout on a phone.
 *
 * Pinned to summer 2026 through the URL, since the mock sessions are all 2026.
 * Week 10 is the week of August 3; week 1 the week of June 1.
 */

const WEEK_10 = '/summer?summer=2026&week=10';

/**
 * Load a page and let it hydrate before touching it. A click, or a Back, that
 * lands before hydration is lost, or leaves the router seeded with a URL the
 * server did not render — a flake on a cold dev server, not app behaviour.
 */
async function settle(page: Page, load: () => Promise<unknown>) {
  await load();
  await page.waitForLoadState('networkidle');
}

function open(page: Page, url: string) {
  return settle(page, () => page.goto(url));
}

function tile(page: Page, number: number) {
  // Exact: "Week 1, Monday" is a prefix of "Week 10, Monday …".
  return page.getByRole('button', { name: new RegExp(`^Week ${String(number)}, Monday`) });
}

function card(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
}

function weekHeading(page: Page) {
  return page.getByRole('heading', { level: 2 });
}

async function boxOf(locator: ReturnType<Page['getByRole']>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('No layout box');
  return box;
}

test('week 10 shows the VCU Ironbridge card, and week 1 replaces it', async ({ page }) => {
  await open(page, WEEK_10);
  const ironbridge = card(page, 'VCU Baseball Summer Youth Camps');
  await expect(ironbridge).toContainText('Mon–Wed');
  await expect(ironbridge).toContainText('Covers 3 of 5 days, and ends at noon');
  await expect(ironbridge).toContainText('$299');

  await tile(page, 1).click();

  await expect(page).toHaveURL('/summer?summer=2026&week=1');
  await expect(weekHeading(page)).toHaveText('2 camps, week of Jun 1');
  await expect(ironbridge).toHaveCount(0);
  await expect(card(page, 'Wacky Water Welcome')).toBeVisible();
});

test('the selected week survives a reload, and back and forward', async ({ page }) => {
  await open(page, WEEK_10);
  await tile(page, 3).click();
  await expect(weekHeading(page)).toHaveText('3 camps, week of Jun 15');

  await settle(page, () => page.reload());
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'true');
  await expect(weekHeading(page)).toHaveText('3 camps, week of Jun 15');

  await page.goBack();
  await expect(page).toHaveURL(WEEK_10);
  await expect(tile(page, 10)).toHaveAttribute('aria-pressed', 'true');
  await expect(weekHeading(page)).toHaveText('3 camps, week of Aug 3');

  await page.goForward();
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'true');
});

test('an out-of-range week shows week 1', async ({ page }) => {
  await open(page, '/summer?summer=2026&week=99');
  await expect(tile(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(weekHeading(page)).toHaveText('2 camps, week of Jun 1');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('has no horizontal page scroll', async ({ page }) => {
    await open(page, WEEK_10);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('keeps the week tab on the left and wraps a long camp name', async ({ page }) => {
    await open(page, WEEK_10);
    const ironbridge = card(page, 'VCU Baseball Summer Youth Camps');
    const name = await boxOf(ironbridge.getByRole('heading'));
    const week = await boxOf(ironbridge.getByText('Week 10', { exact: true }));

    expect(week.x + week.width).toBeLessThanOrEqual(name.x);
    // Wrapped, not truncated: the whole name is on the page, over more than one line.
    await expect(ironbridge.getByRole('heading')).toHaveText('VCU Baseball Summer Youth Camps');
    expect(name.height).toBeGreaterThan(40);
  });

  test('keeps every card button at least 44px tall', async ({ page }) => {
    await open(page, '/summer?summer=2026&week=1');
    const buttons = page.getByRole('list').getByRole('link');
    await expect(buttons.first()).toBeVisible();
    for (const button of await buttons.all()) {
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
