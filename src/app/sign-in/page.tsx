import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/server';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * The app's only sign-in page (CAM-41). Nothing links here yet: reviewers go
 * to it directly, and CAM-8 adds the public link for parents.
 *
 * `?next=` is where to land after signing in, and `?error=link` is how the
 * callback says the link did not work.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [{ data }, { next, error }] = await Promise.all([supabase.auth.getUser(), searchParams]);
  if (data.user) redirect('/');

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-heading text-ink">Sign in</h1>
      <p className="mt-3 text-body text-ink-muted">
        Enter your email and we'll send you a link. There is no password.
      </p>
      {error === 'link' && (
        <p role="alert" className="mt-6 rounded-control border border-brick p-3 text-body text-ink">
          That link didn't work. It may have expired or already been used. Enter your email to
          request a new one.
        </p>
      )}
      <SignInForm next={safeNextPath(next)} />
    </main>
  );
}
