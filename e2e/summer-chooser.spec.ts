import { expect, type Page, test } from '@playwright/test';

/**
 * The summer chooser (CAM-31). The unit suite covers which summers are offered,
 * the default, and the fallback for a bad `?summer=`. This covers what needs a
 * real browser: navigating between summers, the week picker starting over,
 * the choice surviving a reload, keyboard use and touch-target size.
 *
 * Every test names its summer in the URL, so the default moving with the date
 * cannot change them. Summer 2026 is 12 weeks; summer 2027 is 11.
 */

function summer(page: Page, year: number) {
  return page
    .getByRole('navigation', { name: 'Choose a summer' })
    .getByRole('link', { name: `Summer ${String(year)}` });
}

function tile(page: Page, number: number) {
  return page.getByRole('button', { name: `Week ${String(number)}, Monday` });
}

test('switching summers shows its weeks and starts the picker again at week 1', async ({
  page,
}) => {
  await page.goto('/camps?summer=2027');
  await tile(page, 3).click();
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'true');

  await summer(page, 2026).click();

  await expect(page).toHaveURL('/camps?summer=2026');
  await expect(page.getByText('Chesterfield, 2026 · 12 weeks')).toBeVisible();
  await expect(summer(page, 2026)).toHaveAttribute('aria-current', 'true');
  await expect(tile(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, 3)).toHaveAttribute('aria-pressed', 'false');
});

test('the chosen summer survives a reload', async ({ page }) => {
  await page.goto('/camps?summer=2026');
  await page.reload();
  await expect(summer(page, 2026)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('Chesterfield, 2026 · 12 weeks')).toBeVisible();
});

test('a summer is chosen from the keyboard with Enter', async ({ page }) => {
  await page.goto('/camps?summer=2027');
  await summer(page, 2026).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/camps?summer=2026');
  await expect(summer(page, 2026)).toHaveAttribute('aria-current', 'true');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps every summer link at least 44px square', async ({ page }) => {
    await page.goto('/camps?summer=2027');
    for (const year of [2026, 2027]) {
      const box = await summer(page, year).boundingBox();
      if (!box) throw new Error(`Summer ${String(year)} has no layout box`);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
