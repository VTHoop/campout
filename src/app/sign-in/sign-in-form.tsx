'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/browser';

/** One `@`, a dot in the domain, no spaces. Supabase does the real check; this stops the obvious slip. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVALID_EMAIL = 'Enter a valid email address.';
const SEND_FAILED = "We couldn't send the link. Wait a minute and try again.";

const ERROR_ID = 'email-error';

/**
 * The magic-link form (CAM-41): one email field, no password, no sign-up step.
 * A new address simply creates an auth user when its link is followed.
 *
 * `next` is the page to return to. It is passed on in the link and checked
 * again by the callback, which is the one that decides.
 */
export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const confirmation = useRef<HTMLHeadingElement>(null);

  // A live region that arrives with its text is announced unreliably; moving
  // focus to the heading is announced everywhere.
  useEffect(() => {
    if (sentTo) confirmation.current?.focus();
  }, [sentTo]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_SHAPE.test(address)) {
      setError(INVALID_EMAIL);
      return;
    }
    void send(address);
  }

  async function send(address: string) {
    setError(null);
    setSending(true);
    const { error: failure } = await createClient().auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    setSending(false);

    if (failure) setError(SEND_FAILED);
    else setSentTo(address);
  }

  if (sentTo) {
    return (
      <div role="status" className="mt-6 flex flex-col gap-3">
        <h2
          ref={confirmation}
          tabIndex={-1}
          className="font-display text-title text-ink outline-none"
        >
          Check your email
        </h2>
        <p className="text-body text-ink-muted">
          We sent a sign-in link to <strong className="text-ink">{sentTo}</strong>.
        </p>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => {
            setSentTo(null);
            setEmail('');
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-3">
      <label htmlFor="email" className="text-ui font-semibold text-ink">
        Email
      </label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ERROR_ID : undefined}
      />
      {error && (
        <p id={ERROR_ID} role="alert" className="text-ui text-brick">
          {error}
        </p>
      )}
      <Button type="submit" disabled={sending} className="self-start">
        Email me a link
      </Button>
    </form>
  );
}
