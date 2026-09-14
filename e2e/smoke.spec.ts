import { expect, test } from '@playwright/test';

/**
 * The smoke lane (ADR-0009). It answers one question unit tests structurally
 * cannot: does the whole app actually boot? A missing environment variable or a
 * broken provider fails here and nowhere else.
 */
test('the app mounts without uncaught errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Campout' })).toBeVisible();
  expect(errors).toEqual([]);
});
