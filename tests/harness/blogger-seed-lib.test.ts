import { describe, expect, it, vi } from 'vitest';
import { BloggerApiError, PacedBloggerClient, createSeedPlan, parseRetryAfter } from '../../tools/blogger-seed-lib.js';

describe('paced Blogger seeding', () => {
  it('builds an idempotent resume plan from existing fixture titles', () => { expect(createSeedPlan(['a', 'b', 'c'], [{ id: '1', title: 'a' }, { id: '2', title: 'b' }])).toEqual({ expected: 3, existing: 2, create: 1, update: 2 }); });
  it('paces every API request at least four seconds apart', async () => { let now = 1000; const starts: number[] = []; const fetcher = vi.fn(async () => { starts.push(now); return new Response('{}', { status: 200 }); }); const client = new PacedBloggerClient('token', fetcher, async (ms) => { now += ms; }, () => now); await client.request('https://example.test/1'); await client.request('https://example.test/2'); expect(starts).toEqual([1000, 5000]); });
  it('classifies 429 with Retry-After without silently retrying a mutation', async () => { const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { errors: [{ reason: 'rateLimitExceeded' }] } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '12' } })); const client = new PacedBloggerClient('token', fetcher); await expect(client.request('https://example.test')).rejects.toEqual(expect.objectContaining<BloggerApiError>({ status: 429, reason: 'rateLimitExceeded', retryAfterMs: 12000 })); expect(fetcher).toHaveBeenCalledOnce(); });
  it('parses retry-after seconds', () => { expect(parseRetryAfter('9')).toBe(9000); });
});
