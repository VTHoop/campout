import { describe, expect, it } from 'vitest';
import { siteUrl } from './site-url';

describe('siteUrl', () => {
  it('uses the Host header over the origin the server reports', () => {
    const request = new Request('http://localhost:3000/x', { headers: { host: '127.0.0.1:3000' } });
    expect(siteUrl('/camps?week=3', request).href).toBe('http://127.0.0.1:3000/camps?week=3');
  });

  it('prefers x-forwarded-host, as set by a proxy', () => {
    const request = new Request('https://internal.test/x', {
      headers: { host: 'internal.test', 'x-forwarded-host': 'campout.example' },
    });
    expect(siteUrl('/', request).href).toBe('https://campout.example/');
  });

  it('falls back to the request URL when there is no host header', () => {
    expect(siteUrl('/', new Request('https://campout.test/x')).href).toBe('https://campout.test/');
  });
});
