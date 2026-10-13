import { expect, type Page, test } from '@playwright/test';
import { withSeededSession } from '../supabase/tests/catalog-fixtures';
import { serviceClient } from '../supabase/tests/helpers';
import { signInLinkFor } from './mailpit';

/**
 * A reviewer approving from the card (CAM-46). The unit suites cover which
 * controls show and what each click sends; the RLS suite covers what the
 * database accepts. This covers what needs a real browser and a real session:
 * the keyboard, focus, the modal dialog's Escape, and fitting at 400px.
 *
 * Each test stands up its own draft chain (a session on July 12–16, 2027, so
 * week 6) and signs in as a fresh reviewer. Drafts are invisible to everyone
 * else, so the other specs never see them.
 */
test.describe.configure({ mode: 'serial' });

const URL = '/camps?summer=2027&week=6';
const CAMP = 'Fixture Day Camp';
const DRAFT = 'Draft · not yet verified';

/** Sign in by magic link, then list the new user as a reviewer. Returns a clean-up. */
async function signInAsReviewer(page: Page): Promise<() => Promise<void>> {
  const address = `approver-${Date.now()}@example.com`;
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(address);
  await page.getByRole('button', { name: 'Email me a link' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();
  await page.goto(await signInLinkFor(page, address));
  await expect(page).toHaveURL('/camps');

  const admin = serviceClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((candidate) => candidate.email === address);
  if (user === undefined) throw new Error(`No user for ${address}`);
  await admin.from('reviewers').insert({ user_id: user.id, display_name: 'E2E reviewer' });
  return async () => {
    await admin.auth.admin.deleteUser(user.id);
  };
}

function card(page: Page) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: CAMP }) });
}

function control(page: Page, name: string) {
  return card(page).getByRole('button', { name });
}

async function openDraftCard(page: Page) {
  await page.goto(URL);
  await page.waitForLoadState('networkidle');
  await expect(card(page)).toBeVisible();
}

test('approves from the keyboard, and focus lands on the card', async ({ page }) => {
  const cleanUp = await signInAsReviewer(page);
  try {
    await withSeededSession(async (ids, admin) => {
      await admin.from('session_options').insert({ session_id: ids.sessionId, kind: 'full_day' });
      await openDraftCard(page);

      const provider = control(page, 'Approve provider: Fixture Rec League');
      await provider.focus();
      await page.keyboard.press('Enter');

      await expect(provider).toHaveCount(0);
      await expect(card(page).locator(':focus')).toHaveCount(0);
      expect(await card(page).evaluate((el) => el === document.activeElement)).toBe(true);
    });
  } finally {
    await cleanUp();
  }
});

test('a refusal shows the database’s words beside the control, and the record stays a draft', async ({
  page,
}) => {
  const cleanUp = await signInAsReviewer(page);
  try {
    await withSeededSession(async () => {
      await openDraftCard(page);
      await control(page, `Approve session: ${CAMP}`).click();

      await expect(card(page).getByRole('alert')).toHaveText(
        "approve the session's camp, provider and location first",
      );
      await expect(card(page).getByText(DRAFT)).toBeVisible();
      await expect(control(page, `Approve session: ${CAMP}`)).toBeEnabled();
    });
  } finally {
    await cleanUp();
  }
});

test('a 15-day session asks first; Escape cancels and returns focus; confirming verifies it', async ({
  page,
}) => {
  const cleanUp = await signInAsReviewer(page);
  try {
    await withSeededSession(async (ids, admin) => {
      await admin.from('sessions').update({ end_date: '2027-07-26' }).eq('id', ids.sessionId);
      await admin.from('session_options').insert({ session_id: ids.sessionId, kind: 'full_day' });
      await openDraftCard(page);

      for (const name of [
        'Approve provider: Fixture Rec League',
        'Approve location: Fixture Community Center',
        `Approve camp: ${CAMP}`,
      ]) {
        await control(page, name).click();
        await expect(control(page, name)).toHaveCount(0);
      }

      const session = control(page, `Approve session: ${CAMP}`);
      await session.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('15 days');

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(session).toBeFocused();
      await expect(card(page).getByText(DRAFT)).toBeVisible();

      await session.click();
      await dialog.getByRole('button', { name: 'Approve' }).click();
      await expect(card(page).getByText(/^Verified /)).toBeVisible();
      await expect(card(page).getByText(DRAFT)).toHaveCount(0);
    });
  } finally {
    await cleanUp();
  }
});

test('the controls fit the card at 400px with no horizontal scroll', async ({ page }) => {
  const cleanUp = await signInAsReviewer(page);
  try {
    await withSeededSession(async () => {
      await page.setViewportSize({ width: 400, height: 800 });
      await openDraftCard(page);
      await expect(card(page).getByRole('button', { name: /^Approve / })).toHaveCount(4);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  } finally {
    await cleanUp();
  }
});
