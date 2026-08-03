import { describe, expect, it, vi } from 'vitest';
import { BloggerDiscoveryClient } from '../../tools/harness/blogger-api.js';
import { HarnessHttpClient } from '../../tools/harness/http.js';

const post = (id: string) => ({
  id,
  url: `https://example.blogspot.com/2026/08/${id}.html`,
  title: `Post ${id}`,
  content: `<p>Content ${id}</p>`,
  labels: ['Testing'],
  published: '2026-08-03T00:00:00Z',
  updated: '2026-08-03T00:00:00Z'
});

describe('Blogger API discovery', () => {
  it('requires an API key or OAuth token', () => {
    const http = new HarnessHttpClient({ paceMs: 4_000, fetch: vi.fn() });
    expect(() => new BloggerDiscoveryClient(http, {})).toThrow('API key or OAuth');
  });

  it('exhausts nextPageToken pagination and requests partial fields', async () => {
    let now = 0;
    const sleep = async (milliseconds: number) => { now += milliseconds; };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [post('one')], nextPageToken: 'next' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [post('two')] }), { status: 200 }));
    const http = new HarnessHttpClient({ paceMs: 4_000, fetch, sleep, now: () => now });
    const client = new BloggerDiscoveryClient(http, { apiKey: 'test-key' });

    const posts = await client.listAllPosts('12345');

    expect(posts.map((item) => item.id)).toEqual(['one', 'two']);
    expect(fetch).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetch.mock.calls[0]?.[0]));
    const secondUrl = new URL(String(fetch.mock.calls[1]?.[0]));
    expect(firstUrl.pathname).toBe('/blogger/v3/blogs/12345/posts');
    expect(firstUrl.searchParams.get('fields')).toContain('nextPageToken');
    expect(secondUrl.searchParams.get('pageToken')).toBe('next');
  });

  it('validates untrusted API JSON instead of trusting TypeScript types', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ items: [{ id: 'missing-fields' }] }), { status: 200 }));
    const http = new HarnessHttpClient({ paceMs: 4_000, fetch });
    const client = new BloggerDiscoveryClient(http, { accessToken: 'token' });

    await expect(client.listAllPosts('12345')).rejects.toThrow('items[0].url');
  });
});
