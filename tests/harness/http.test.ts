import { describe, expect, it, vi } from 'vitest';
import {
  HarnessHttpClient,
  detectBlockedResponse,
  parseRetryAfter
} from '../../tools/harness/http.js';

describe('Blogger harness HTTP transport', () => {
  it('rejects pacing below the four-second safety floor', () => {
    expect(() => new HarnessHttpClient({ paceMs: 3_999 })).toThrow('>= 4000ms');
  });

  it('parses Retry-After seconds and HTTP dates', () => {
    expect(parseRetryAfter('7', 0)).toBe(7_000);
    expect(parseRetryAfter('Thu, 01 Jan 1970 00:00:10 GMT', 4_000)).toBe(6_000);
    expect(parseRetryAfter('nonsense', 0)).toBeNull();
  });

  it('classifies throttling and known Blogger challenges as blocked', () => {
    expect(detectBlockedResponse(429, '')).toContain('rate limited');
    expect(detectBlockedResponse(200, '<script>solveSimpleChallenge()</script>')).toContain('challenge');
    expect(detectBlockedResponse(200, '<main>Real blog output</main>')).toBeNull();
  });

  it('serializes requests and waits at least four seconds between starts', async () => {
    let now = 10_000;
    const starts: number[] = [];
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const fetch = vi.fn(async () => {
      starts.push(now);
      return new Response('ok', { status: 200 });
    });
    const client = new HarnessHttpClient({ paceMs: 4_000, fetch, sleep, now: () => now });

    await Promise.all([
      client.get('https://staging-ledger-theme.blogspot.com/'),
      client.get('https://staging-ledger-theme.blogspot.com/search')
    ]);

    expect(starts).toEqual([10_000, 14_000]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('honors Retry-After before the next request without retrying the blocked request', async () => {
    let now = 20_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('limited', {
        status: 429,
        headers: { 'Retry-After': '9' }
      }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const client = new HarnessHttpClient({ paceMs: 4_000, fetch, sleep, now: () => now });

    const blocked = await client.get('https://staging-ledger-theme.blogspot.com/');
    await client.get('https://staging-ledger-theme.blogspot.com/search');

    expect(blocked.blocked).toBe(true);
    expect(sleep).toHaveBeenCalledWith(9_000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('requests gzip with an identifying user agent', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('accept-encoding')).toBe('gzip');
      expect(headers.get('user-agent')).toContain('(gzip)');
      return new Response('ok', { status: 200 });
    });
    const client = new HarnessHttpClient({ paceMs: 4_000, fetch });

    await client.get('https://staging-ledger-theme.blogspot.com/');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
