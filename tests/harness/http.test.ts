import { describe, expect, it, vi } from 'vitest';
import { HarnessHttpClient, detectBlockedResponse, parseRetryAfter } from '../../tools/harness/http.js';

describe('Blogger harness HTTP transport', () => {
  it('rejects pacing below the four-second safety floor', () => {
    expect(() => new HarnessHttpClient({ paceMs: 3_999 })).toThrow('>= 4000ms');
  });

  it('parses Retry-After seconds and HTTP dates', () => {
    expect(parseRetryAfter('7', 0)).toBe(7_000);
    expect(parseRetryAfter('Thu, 01 Jan 1970 00:00:10 GMT', 4_000)).toBe(6_000);
    expect(parseRetryAfter('nonsense', 0)).toBeNull();
  });

  it('classifies HTTP and structured API quota failures as blocked', () => {
    expect(detectBlockedResponse(429, '')).toContain('rate limited');
    expect(detectBlockedResponse(403, JSON.stringify({ error: { errors: [{ reason: 'rateLimitExceeded' }] } })))
      .toContain('quota');
    expect(detectBlockedResponse(403, JSON.stringify({ error: { errors: [{ reason: 'forbidden' }] } })))
      .toBeNull();
    expect(detectBlockedResponse(200, '<script>solveSimpleChallenge()</script>')).toContain('challenge');
  });

  it('serializes requests and waits at least four seconds between starts', async () => {
    let now = 10_000;
    const starts: number[] = [];
    const sleep = vi.fn(async (milliseconds: number) => { now += milliseconds; });
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
  });

  it('paces the next request even when fetch throws and releases the queue', async () => {
    let now = 20_000;
    const starts: number[] = [];
    const sleep = vi.fn(async (milliseconds: number) => { now += milliseconds; });
    const fetch = vi.fn(async () => {
      starts.push(now);
      if (starts.length === 1) {
        throw new TypeError('socket failed');
      }
      return new Response('ok', { status: 200 });
    });
    const client = new HarnessHttpClient({ paceMs: 4_000, fetch, sleep, now: () => now });

    await expect(client.get('https://staging-ledger-theme.blogspot.com/')).rejects.toThrow('socket failed');
    await client.get('https://staging-ledger-theme.blogspot.com/search');

    expect(starts).toEqual([20_000, 24_000]);
  });

  it('supplies a finite abort deadline to fetch', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      return new Response('ok', { status: 200 });
    });
    const client = new HarnessHttpClient({ paceMs: 4_000, timeoutMs: 50, fetch });
    await client.get('https://staging-ledger-theme.blogspot.com/');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('honors Retry-After before the next request without retrying', async () => {
    let now = 30_000;
    const sleep = vi.fn(async (milliseconds: number) => { now += milliseconds; });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('limited', { status: 429, headers: { 'Retry-After': '9' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const client = new HarnessHttpClient({ paceMs: 4_000, fetch, sleep, now: () => now });

    await client.get('https://staging-ledger-theme.blogspot.com/');
    await client.get('https://staging-ledger-theme.blogspot.com/search');

    expect(sleep).toHaveBeenCalledWith(9_000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
