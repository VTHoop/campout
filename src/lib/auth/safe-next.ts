/**
 * Where to send a user after sign-in, taken from a `?next=` value that anyone
 * can put in a link. Only a path on this site is allowed; everything else,
 * including a full URL, a `//host` path and a missing value, becomes `/`.
 *
 * Browsers read `\` as `/` and drop tabs and newlines inside a URL, so `/\host`
 * and `/<tab>/host` are both `//host` by the time they are followed.
 */
const BROWSER_SEPARATORS = /[\\\t\n\r]/;

export function safeNextPath(value: string | string[] | null | undefined): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (BROWSER_SEPARATORS.test(value)) return '/';
  return value;
}
