import { expect, type Page, test } from '@playwright/test';

/**
 * Magic-link sign-in and sign out (CAM-41). The unit suite covers the form's
 * states and the callback's redirect handling; this covers what only a real
 * browser and a real Supabase Auth can: the emailed link, the session cookie,
 * and staying signed in across a reload.
 *
 * Local Supabase catches its mail in Mailpit (port 54324), so no real email is
 * sent. Each run uses its own address, so runs cannot read each other's mail.
 */
const MAILPIT = 'http://127.0.0.1:54324/api/v1';

interface MailpitList {
  messages: { ID: string; To: { Address: string }[] }[];
}

async function signInLinkFor(page: Page, address: string): Promise<string> {
  let id: string | undefined;
  await expect(async () => {
    const list: MailpitList = await (await page.request.get(`${MAILPIT}/messages`)).json();
    id = list.messages.find((message) => message.To.some((to) => to.Address === address))?.ID;
    expect(id).toBeDefined();
  }).toPass();

  const message: { Text: string } = await (
    await page.request.get(`${MAILPIT}/message/${id}`)
  ).json();
  const link = message.Text.match(/https?:\/\/[^\s\]>)]+/)?.[0];
  if (!link) throw new Error(`No link in the sign-in email to ${address}`);
  return link;
}

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
  await expect(page.getByRole('alert')).toContainText("That link didn't work");
  await expect(nav(page).getByRole('button', { name: 'Sign out' })).toHaveCount(0);
});
