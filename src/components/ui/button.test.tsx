import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders a native button carrying its props', () => {
    render(
      <Button type="button" aria-pressed="true">
        Week 1
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Week 1', pressed: true })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('renders its child in place of a button when asChild is set', () => {
    render(
      <Button asChild variant="outline">
        <a href="/summer">Summer</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Summer' })).toHaveAttribute('data-slot', 'button');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
