import { expect, type Page, test } from '@playwright/test';
import { signInLinkFor } from './mailpit';

/**
 * Magic-link sign-in and sign out (CAM-41). The unit suite covers the form's
 * states and the callback's redirect handling; this covers what only a real
 * browser and a real Supabase Auth can: the emailed link, the session cookie,
 * and staying signed in across a reload.
 */

function nav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' });
}

test('sign in from a magic link, stay signed in on reload, then sign out', async ({ page }) => {
  const address = `reviewer-${Date.now()}@example.com`;

  await page.goto('/camps');
  await expect(nav(page).getByRole('button', { name: 'Sign out' })).toHaveCount(0);

  await page.goto('/sign-in?next=%2Fcamps');
  await page.getByLabel('Email').fill(address);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();
  await expect(page.getByText(address)).toBeVisible();

  await page.goto(await signInLinkFor(page, address));

  await expect(page).toHaveURL('/camps');
  await expect(nav(page).getByRole('button', { name: 'Sign out' })).toBeVisible();

  await page.reload();
  await expect(nav(page).getByRole('button', { name: 'Sign out' })).toBeVisible();

  await page.goto('/sign-in');
  await expect(page).toHaveURL('/summer');

  await nav(page).getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/summer');
  await expect(nav(page).getByRole('button', { name: 'Sign out' })).toHaveCount(0);
});

test('a link that was already used lands on /sign-in with a message, signed out', async ({
  page,
}) => {
  const address = `reviewer-${Date.now()}-reuse@example.com`;
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(address);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();
  const link = await signInLinkFor(page, address);

  await page.goto(link);
  await nav(page).getByRole('button', { name: 'Sign out' }).click();
  await page.goto(link);

  await expect(page).toHaveURL(/\/sign-in\?error=link/);
  // Scoped to main: Next's route announcer is a second role=alert on every page.
  await expect(page.getByRole('main').getByRole('alert')).toContainText("That link didn't work");
  await expect(nav(page).getByRole('button', { name: 'Sign out' })).toHaveCount(0);
});
