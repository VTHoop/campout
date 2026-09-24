import { expect, type Page, test } from '@playwright/test';

/**
 * The app nav bar (CAM-29). The unit suite covers its links and aria-current;
 * this covers what only a real browser can: the redirect status, the 404 page,
 * and which layout each viewport gets. The layout switches at Tailwind's `lg`
 * (1024px), so 390px is the phone case and 1280px the desktop one.
 */

function nav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' });
}

async function boxOf(page: Page, name: string) {
  const box = await nav(page).getByRole('link', { name }).boundingBox();
  if (!box) throw new Error(`The ${name} link has no layout box`);
  return box;
}

test('the root redirect is temporary, so Home can claim / later', async ({ request }) => {
  const response = await request.get('/', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe('/summer');
});

test('the tabs move between Summer and Days off', async ({ page }) => {
  await page.goto('/summer');
  await nav(page).getByRole('link', { name: 'Days off' }).click();

  await expect(page).toHaveURL('/days-off');
  await expect(page).toHaveTitle('Days off · Campout');
  await expect(nav(page).getByRole('link', { name: 'Days off' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await nav(page).getByRole('link', { name: 'Summer' }).click();
  await expect(page).toHaveURL('/summer');
  await expect(page).toHaveTitle('Summer · Campout');
});

test('the 404 page keeps the nav, so a bad URL still has a way back', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(nav(page)).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stacks the tabs beneath the wordmark, splitting the width', async ({ page }) => {
    await page.goto('/summer');
    const wordmark = await boxOf(page, 'Campout home');
    const summer = await boxOf(page, 'Summer');
    const daysOff = await boxOf(page, 'Days off');

    expect(summer.y).toBeGreaterThanOrEqual(wordmark.y + wordmark.height);
    expect(daysOff.y).toBe(summer.y);
    expect(summer.width + daysOff.width).toBeGreaterThan(390 * 0.8);
    expect(summer.height).toBeGreaterThanOrEqual(44);
    expect(daysOff.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sets the tabs inline after the wordmark', async ({ page }) => {
    await page.goto('/summer');
    const wordmark = await boxOf(page, 'Campout home');
    const summer = await boxOf(page, 'Summer');
    const daysOff = await boxOf(page, 'Days off');

    expect(summer.y).toBeLessThan(wordmark.y + wordmark.height);
    expect(summer.x).toBeGreaterThan(wordmark.x + wordmark.width);
    expect(daysOff.x).toBeGreaterThan(summer.x + summer.width);
    expect(summer.width + daysOff.width).toBeLessThan(1280 / 2);
  });
});
