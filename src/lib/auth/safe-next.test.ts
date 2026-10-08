import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it.each([
    ['/', '/'],
    ['/camps', '/camps'],
    ['/camps?summer=2027&week=3', '/camps?summer=2027&week=3'],
    ['/days-off#top', '/days-off#top'],
  ])('keeps the on-site path %s', (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it.each([
    ['a full URL', 'https://evil.example/phish'],
    ['a scheme-relative //host path', '//evil.example'],
    ['a backslash host path', '/\\evil.example'],
    ['a path with a tab, which browsers strip', '/\t/evil.example'],
    ['a relative path', 'camps'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['an empty value', ''],
    ['a missing value', null],
    ['an undefined value', undefined],
    ['a repeated query value', ['/camps', '/summer']],
  ])('sends %s to /', (_label, value) => {
    expect(safeNextPath(value)).toBe('/');
  });
});
