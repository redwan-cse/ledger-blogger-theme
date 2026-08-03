import { describe, expect, it, vi } from 'vitest';
import { BloggerDiscoveryClient } from '../../tools/harness/blogger-api.js';
import { HarnessHttpClient, type FetchLike } from '../../tools/harness/http.js';

const post = (id: string) => ({ id, url: `https://example.blogspot.com/${id}.html`, title: `Post ${id}`, content: `<p>${id}</p>`, labels: ['Testing'], published: '2026-08-03T00:00:00Z', updated: '2026-08-03T00:00:00Z' });

describe('Blogger API discovery', () => {
  it('requires an API key or OAuth token', () => {
    const http = new HarnessHttpClient({ paceMs: 4000, fetch: vi.fn<FetchLike>() });
    expect(() => new BloggerDiscoveryClient(http, {})).toThrow('API key or OAuth');
  });

  it('exhausts live-post pagination and requests partial fields', async () => {
    let now = 0;
    const requestedUrls: URL[] = [];
    const responses = [
      new Response(JSON.stringify({ items: [post('one')], nextPageToken: 'next' }), { status: 200 }),
      new Response(JSON.stringify({ items: [post('two')] }), { status: 200 })
    ];
    const fetcher: FetchLike = async (input) => {
      requestedUrls.push(new URL(String(input)));
      const response = responses.shift();
      if (!response) throw new Error('Unexpected request.');
      return response;
    };
    const client = new BloggerDiscoveryClient(new HarnessHttpClient({ paceMs: 4000, fetch: fetcher, sleep: async (ms) => { now += ms; }, now: () => now }), { apiKey: 'key' });

    expect((await client.listAllPosts('123')).map((item) => item.id)).toEqual(['one', 'two']);
    expect(requestedUrls[0]?.searchParams.get('status')).toBe('live');
    expect(requestedUrls[1]?.searchParams.get('pageToken')).toBe('next');
  });

  it('accepts content omitted by Blogger for an empty live post', async () => {
    const emptyPost = post('empty');
    const { content: _content, ...withoutContent } = emptyPost;
    const fetcher: FetchLike = async () => new Response(JSON.stringify({ items: [withoutContent] }), { status: 200 });
    const client = new BloggerDiscoveryClient(new HarnessHttpClient({ paceMs: 4000, fetch: fetcher }), { accessToken: 'token' });

    expect((await client.listAllPosts('123'))[0]?.content).toBe('');
  });

  it('discovers static pages through pages.list', async () => {
    const requestedUrls: URL[] = [];
    const fetcher: FetchLike = async (input) => {
      requestedUrls.push(new URL(String(input)));
      return new Response(JSON.stringify({ items: [{ id: 'p1', url: 'https://example.blogspot.com/p/about.html', title: 'About' }] }), { status: 200 });
    };
    const client = new BloggerDiscoveryClient(new HarnessHttpClient({ paceMs: 4000, fetch: fetcher }), { accessToken: 'token' });

    expect(await client.listPages('123')).toEqual([{ id: 'p1', url: 'https://example.blogspot.com/p/about.html', title: 'About' }]);
    expect(requestedUrls[0]?.pathname).toContain('/pages');
  });

  it('validates untrusted API JSON', async () => {
    const fetcher: FetchLike = async () => new Response(JSON.stringify({ items: [{ id: 'missing-fields' }] }), { status: 200 });
    const client = new BloggerDiscoveryClient(new HarnessHttpClient({ paceMs: 4000, fetch: fetcher }), { accessToken: 'token' });
    await expect(client.listAllPosts('123')).rejects.toThrow('items[0].url');
  });
});
