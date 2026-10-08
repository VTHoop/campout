import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/browser';
import { SignInForm } from './sign-in-form';

vi.mock('@/lib/supabase/browser', () => ({ createClient: vi.fn() }));

const signInWithOtp = vi.fn();

function renderForm(next = '/') {
  render(<SignInForm next={next} />);
}

function email() {
  return screen.getByLabelText('Email');
}

function submit(address: string) {
  fireEvent.change(email(), { target: { value: address } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }));
}

describe('SignInForm', () => {
  beforeEach(() => {
    signInWithOtp.mockReset().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOtp },
    } as unknown as ReturnType<typeof createClient>);
  });

  it('asks for one email, with a visible label and no password', () => {
    renderForm();
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'email');
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('sends a magic link whose callback returns to the starting page', async () => {
    renderForm('/camps?week=3');
    submit('pat@example.com');

    await screen.findByText('Check your email');
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'pat@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fcamps%3Fweek%3D3`,
        shouldCreateUser: true,
      },
    });
  });

  it('trims the address before sending it', async () => {
    renderForm();
    submit('  pat@example.com  ');

    await screen.findByText('Check your email');
    expect(signInWithOtp.mock.calls[0][0].email).toBe('pat@example.com');
  });

  it('replaces the form with "Check your email" and the address it went to', async () => {
    renderForm();
    submit('pat@example.com');

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('pat@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('announces the confirmation as a status', async () => {
    renderForm();
    submit('pat@example.com');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Check your email');
  });

  it('offers a different email, back at an empty form', async () => {
    renderForm();
    submit('pat@example.com');
    fireEvent.click(await screen.findByRole('button', { name: 'Use a different email' }));

    expect(email()).toHaveValue('');
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['without an @', 'pat.example.com'],
    ['without a domain', 'pat@'],
    ['without a dot in the domain', 'pat@example'],
  ])('shows an inline error and sends nothing for an address that is %s', (_label, address) => {
    renderForm();
    submit(address);

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Enter a valid email address.');
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveAccessibleDescription('Enter a valid email address.');
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('clears the inline error once a valid address goes through', async () => {
    renderForm();
    submit('nope');
    submit('pat@example.com');

    await screen.findByText('Check your email');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the typed email and shows an error when sending fails', async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: 'For security purposes, you can only request this after 59 seconds.' },
    });
    renderForm();
    submit('pat@example.com');

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent("We couldn't send the link. Wait a minute and try again.");
    expect(email()).toHaveValue('pat@example.com');
    expect(email()).toHaveAccessibleDescription(
      "We couldn't send the link. Wait a minute and try again.",
    );
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
  });

  it('lets the user try again after a failure', async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: 'rate limited' } });
    renderForm();
    submit('pat@example.com');
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }));

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });
});
