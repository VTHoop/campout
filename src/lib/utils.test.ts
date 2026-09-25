import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('lets a later class override an earlier one in the same group', () => {
    expect(cn('bg-surface', 'bg-ink')).toBe('bg-ink');
  });

  it('drops falsy entries', () => {
    expect(cn('text-ink', false, undefined, 'border')).toBe('text-ink border');
  });

  it('keeps a Campout type token beside a text colour, because one is a size and the other a colour', () => {
    expect(cn('text-ui', 'text-ink')).toBe('text-ui text-ink');
  });

  it('lets a later Campout type token override an earlier one', () => {
    expect(cn('text-ui', 'text-caption')).toBe('text-caption');
  });
});
