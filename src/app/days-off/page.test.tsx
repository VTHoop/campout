import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DaysOffPage, { metadata } from './page';

describe('DaysOffPage', () => {
  it('is headed Days off', () => {
    render(<DaysOffPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Days off');
  });

  it('titles the browser tab Days off', () => {
    expect(metadata.title).toBe('Days off');
  });

  it('shows placeholder text until the real page lands', () => {
    render(<DaysOffPage />);
    expect(screen.getByText('You are on the Days off page.')).toBeInTheDocument();
  });
});
