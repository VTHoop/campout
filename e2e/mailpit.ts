import { expect, type Page } from '@playwright/test';

/**
 * Local Supabase catches its mail in Mailpit (port 54324), so no real email is
 * sent. Each caller uses its own address, so runs cannot read each other's mail.
 */
const MAILPIT = 'http://127.0.0.1:54324/api/v1';

interface MailpitList {
  messages: { ID: string; To: { Address: string }[] }[];
}

/** The magic link emailed to `address`, once it has arrived. */
export async function signInLinkFor(page: Page, address: string): Promise<string> {
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

/** Sign in as a new address by emailed link, landing on `next`. Returns the address. */
export async function signInByMagicLink(page: Page, next: string): Promise<string> {
  const address = `approver-${Date.now()}@example.com`;
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(address);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();
  await page.goto(await signInLinkFor(page, address));
  await expect(page).toHaveURL(next);
  return address;
}
