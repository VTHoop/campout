import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input', () => {
  it('renders a native input of the given type, carrying its props', () => {
    render(<Input type="email" aria-label="Email" required />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeRequired();
  });

  it('merges a caller class with its own', () => {
    render(<Input aria-label="Name" className="max-w-xs" />);
    expect(screen.getByLabelText('Name')).toHaveClass('max-w-xs', 'min-h-touch');
  });
});
