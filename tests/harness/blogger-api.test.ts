import { describe, expect, it, vi } from 'vitest';
import { BloggerDiscoveryClient } from '../../tools/harness/blogger-api.js';
import { HarnessHttpClient } from '../../tools/harness/http.js';
const post = (id: string) => ({ id, url: `https://example.blogspot.com/${id}.html`, title: `Post ${id}`, content: `<p>${id}</p>`, labels: ['Testing'], published: '2026-08-03T00:00:00Z', updated: '2026-08-03T00:00:00Z' });

describe('Blogger API discovery', () => {
  it('requires an API key or OAuth token', () => { const http = new HarnessHttpClient({ paceMs: 4000, fetch: vi.fn() }); expect(() => new BloggerDiscoveryClient(http, {})).toThrow('API key or OAuth'); });
  it('exhausts post pagination and requests partial fields', async () => {
    let now = 0; const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ items: [post('one')], nextPageToken: 'next' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ items: [post('two')] }), { status: 200 }));
    const client = new BloggerDiscoveryClient(new HarnessHttpClient({ paceMs: 4000, fetch, sleep: async (ms) => { now += ms; }, now: () => now }), { apiKey: 'key' });
    expect((await client.listAllPosts('123')).map((item) => item.id)).toEqual(['one', 'two']);
    expect(new URL(String(fetch.mock.calls[1]?.[0])).searchParams.get('pageToken')).toBe('next');
  });
  it('discovers static pages through pages.list', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ items: [{ id: 'p1', url: 'https://example.blogspot.com/p/about.html', title: 'About' }] }), { status: 200 }));
    const client = new BloggerDiscoveryClient(new HarnessHttpClient({ paceMs: 4000, fetch }), { accessToken: 'token' });
    expect(await client.listPages('123')).toEqual([{ id: 'p1', url: 'https://example.blogspot.com/p/about.html', title: 'About' }]);
    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toContain('/pages');
  });
  it('validates untrusted API JSON', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ items: [{ id: 'missing-fields' }] }), { status: 200 }));
    const client = new BloggerDiscoveryClient(new HarnessHttpClient({ paceMs: 4000, fetch }), { accessToken: 'token' });
    await expect(client.listAllPosts('123')).rejects.toThrow('items[0].url');
  });
});
