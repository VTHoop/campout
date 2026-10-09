import { describe, expect, it } from 'vitest';
import { Constants } from '@/lib/db/types';
import { Category } from './types';

describe('Category', () => {
  it('is the database camp_category enum, value for value (ADR-0018)', () => {
    expect(Object.values(Category).sort()).toEqual(
      [...Constants.public.Enums.camp_category].sort(),
    );
  });
});
