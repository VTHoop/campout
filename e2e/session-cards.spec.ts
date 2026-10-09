import { expect, type Page, test } from '@playwright/test';

/**
 * Session cards for the selected summer week (CAM-32, CAM-28). The unit suites
 * cover the card's facts and which cards a week shows; this covers what needs a
 * real browser: the week in the URL through reload and back/forward, and the
 * card's layout on a phone.
 *
 * Runs against the local seed as a signed-out visitor, so it sees the four
 * verified sessions and no draft. Pinned to summer 2027 through the URL. Week 3
 * is the week of June 21 (Space Week), week 6 the week of July 12 (the swim
 * camp), week 7 the week of July 19 (the arts camp); week 1 has no camp.
 */

const WEEK_6 = '/camps?summer=2027&week=6';
const SWIM_CAMP = 'Maple Hollow Swim Team Camp';
const SUMMER_CAMP = 'Maple Hollow Summer Camp';

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
  // A substring match: "Week 1, Monday" is not inside "Week 11, Monday …".
  return page.getByRole('button', { name: `Week ${String(number)}, Monday` });
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

test('week 6 shows the swim camp card with its facts and verified date, and week 1 replaces it', async ({
  page,
}) => {
  await open(page, WEEK_6);
  const swim = card(page, SWIM_CAMP);
  await expect(swim).toContainText('Mon–Fri');
  await expect(swim).toContainText('$210');
  await expect(swim).toContainText('Hours not stated');
  await expect(swim).toContainText('Verified Sep 1, 2026');
  await expect(swim).not.toContainText('Draft');

  await tile(page, 1).click();

  await expect(page).toHaveURL('/camps?summer=2027&week=1');
  await expect(weekHeading(page)).toHaveText('No camps listed for week 1');
  await expect(swim).toHaveCount(0);
});

test('the selected week survives a reload, and back and forward', async ({ page }) => {
  await open(page, WEEK_6);
  await tile(page, 3).click();
  await expect(weekHeading(page)).toHaveText('1 camp, week of Jun 21');
  await expect(card(page, SUMMER_CAMP)).toBeVisible();

  await settle(page, () => page.reload());
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'true');
  await expect(weekHeading(page)).toHaveText('1 camp, week of Jun 21');

  await page.goBack();
  await expect(page).toHaveURL(WEEK_6);
  await expect(tile(page, 6)).toHaveAttribute('aria-pressed', 'true');
  await expect(weekHeading(page)).toHaveText('1 camp, week of Jul 12');

  await page.goForward();
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'true');
});

test('an out-of-range week shows week 1', async ({ page }) => {
  await open(page, '/camps?summer=2027&week=99');
  await expect(tile(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(weekHeading(page)).toHaveText('No camps listed for week 1');
});

test('shows no draft to a signed-out visitor', async ({ page }) => {
  // The draft clay camp is in week 9 of the seed, and RLS alone keeps it out.
  await open(page, '/camps?summer=2027&week=9');
  await expect(weekHeading(page)).toHaveText('No camps listed for week 9');
  await expect(page.getByText('Draft · not yet verified')).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('brings a linked week’s tile into view', async ({ page }) => {
    await open(page, WEEK_6);
    await expect(tile(page, 6)).toBeInViewport();
  });

  test('has no horizontal page scroll', async ({ page }) => {
    await open(page, WEEK_6);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('keeps the week tab on the left of the camp name', async ({ page }) => {
    await open(page, WEEK_6);
    const swim = card(page, SWIM_CAMP);
    const name = await boxOf(swim.getByRole('heading'));
    const week = await boxOf(swim.getByText('Week 6', { exact: true }));

    expect(week.x + week.width).toBeLessThanOrEqual(name.x);
    // Wrapped, not truncated: the whole name is on the page.
    await expect(swim.getByRole('heading')).toHaveText(SWIM_CAMP);
  });

  test('keeps every card button at least 44px tall', async ({ page }) => {
    await open(page, '/camps?summer=2027&week=3');
    const buttons = page.getByRole('list').getByRole('link');
    await expect(buttons.first()).toBeVisible();
    for (const button of await buttons.all()) {
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
