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
