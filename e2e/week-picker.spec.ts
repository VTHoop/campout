import { expect, type Page, test } from '@playwright/test';

/**
 * The week picker (CAM-30). The unit suite covers the tiles, their names and
 * selection; this covers what needs real layout: one row on every viewport,
 * the paging arrows that appear only when the row overflows, the text block's
 * position, touch-target size and keyboard activation.
 *
 * The placeholder summer is 10 weeks. At 390px it cannot fit; at 1280px it does.
 */

function tile(page: Page, number: number) {
  // A substring match: "Week 1, Monday" is not inside "Week 10, Monday …".
  return page.getByRole('button', { name: `Week ${number}, Monday` });
}

function earlier(page: Page) {
  return page.getByRole('button', { name: 'Earlier weeks' });
}

function later(page: Page) {
  return page.getByRole('button', { name: 'Later weeks' });
}

async function boxOf(locator: ReturnType<Page['getByRole']>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('No layout box');
  return box;
}

test('a tile is chosen from the keyboard with Enter or Space', async ({ page }) => {
  await page.goto('/summer');

  await tile(page, 3).focus();
  await page.keyboard.press('Enter');
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, 1)).toHaveAttribute('aria-pressed', 'false');

  await tile(page, 4).focus();
  await page.keyboard.press('Space');
  await expect(tile(page, 4)).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'false');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sets every tile in one row, beneath the text block', async ({ page }) => {
    await page.goto('/summer');
    const heading = await boxOf(page.getByRole('heading', { name: 'Your summer' }));
    const first = await boxOf(tile(page, 1));
    const last = await boxOf(tile(page, 10));

    expect(first.y).toBeGreaterThanOrEqual(heading.y + heading.height);
    expect(last.y).toBe(first.y);
  });

  test('pages through the weeks with the arrows, disabling each at its end', async ({ page }) => {
    await page.goto('/summer');
    await expect(earlier(page)).toBeDisabled();
    await expect(later(page)).toBeEnabled();
    await expect(tile(page, 10)).not.toBeInViewport();

    await later(page).click();
    await expect(earlier(page)).toBeEnabled();

    // Page on until the end; each click scrolls smoothly, so retry rather than sleep.
    await expect(async () => {
      if (await later(page).isEnabled()) await later(page).click();
      await expect(later(page)).toBeDisabled({ timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await expect(tile(page, 10)).toBeInViewport();
    await expect(tile(page, 1)).not.toBeInViewport();
  });

  test('tracks a swipe: scrolling the row by hand enables the earlier arrow', async ({ page }) => {
    await page.goto('/summer');
    await expect(earlier(page)).toBeDisabled();
    await tile(page, 2).hover();
    await page.mouse.wheel(150, 0);
    await expect(earlier(page)).toBeEnabled();
  });

  test('keeps every tile and arrow at least 44px square', async ({ page }) => {
    await page.goto('/summer');
    for (const target of [tile(page, 1), earlier(page), later(page)]) {
      const box = await boxOf(target);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('fits every week in one row beside the text block, with no arrows', async ({ page }) => {
    await page.goto('/summer');
    const heading = await boxOf(page.getByRole('heading', { name: 'Your summer' }));
    const first = await boxOf(tile(page, 1));
    const last = await boxOf(tile(page, 10));

    expect(first.x).toBeGreaterThanOrEqual(heading.x + heading.width);
    expect(last.y).toBe(first.y);
    await expect(tile(page, 10)).toBeInViewport();
    await expect(earlier(page)).toHaveCount(0);
    await expect(later(page)).toHaveCount(0);
  });
});
