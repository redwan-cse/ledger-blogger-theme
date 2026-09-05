import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeUrls,
  submitToBingWebmaster,
  submitToIndexNow,
  submitUrlsToSearchEngines
} from '../../scripts/lib/search-engine-indexer.js';

describe('search-engine-indexer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeUrls', () => {
    it('normalizes, deduplicates, and resolves relative URLs', () => {
      const input = [
        'https://blogs.redwan.work/2026/09/post-one.html',
        'https://blogs.redwan.work/2026/09/post-one.html', // duplicate
        '/2026/09/post-two.html', // relative
        'invalid-url', // invalid
        '',
        '   https://blogs.redwan.work/2026/09/post-three.html   '
      ];

      const result = normalizeUrls(input, 'https://blogs.redwan.work/');
      expect(result).toEqual([
        'https://blogs.redwan.work/2026/09/post-one.html',
        'https://blogs.redwan.work/2026/09/post-two.html',
        'https://blogs.redwan.work/2026/09/post-three.html'
      ]);
    });
  });

  describe('submitToBingWebmaster', () => {
    it('skips submission if API key is empty', async () => {
      const res = await submitToBingWebmaster(['https://blogs.redwan.work/post.html'], '');
      expect(res.status).toBe('skipped');
      expect(res.message).toContain('Bing Webmaster API Key not provided');
    });

    it('submits a single URL using SubmitUrl endpoint', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ d: null })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await submitToBingWebmaster(
        ['https://blogs.redwan.work/2026/09/sample.html'],
        'sample-bing-key',
        'https://blogs.redwan.work/'
      );

      expect(res.status).toBe('success');
      expect(res.submittedCount).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toContain('SubmitUrl?apikey=sample-bing-key');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.siteUrl).toBe('https://blogs.redwan.work/');
      expect(body.url).toBe('https://blogs.redwan.work/2026/09/sample.html');
    });

    it('submits multiple URLs using SubmitUrlbatch endpoint', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ d: null })
      });
      vi.stubGlobal('fetch', fetchMock);

      const urls = [
        'https://blogs.redwan.work/2026/09/sample-1.html',
        'https://blogs.redwan.work/2026/09/sample-2.html'
      ];
      const res = await submitToBingWebmaster(urls, 'sample-bing-key', 'https://blogs.redwan.work/');

      expect(res.status).toBe('success');
      expect(res.submittedCount).toBe(2);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toContain('SubmitUrlbatch?apikey=sample-bing-key');
      const body = JSON.parse(init.body);
      expect(body.siteUrl).toBe('https://blogs.redwan.work/');
      expect(body.urlList).toEqual(urls);
    });

    it('handles non-200 API errors gracefully without throwing', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ Message: 'Daily quota exceeded' })
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await submitToBingWebmaster(
        ['https://blogs.redwan.work/2026/09/sample.html'],
        'sample-bing-key'
      );

      expect(res.status).toBe('warning');
      expect(res.message).toContain('Daily quota exceeded');
      expect(res.statusCode).toBe(400);
    });

    it('handles dry-run mode without calling fetch', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const res = await submitToBingWebmaster(
        ['https://blogs.redwan.work/2026/09/sample.html'],
        'sample-bing-key',
        'https://blogs.redwan.work/',
        true // dryRun
      );

      expect(res.status).toBe('success');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('submitToIndexNow', () => {
    it('skips submission if IndexNow key is empty', async () => {
      const res = await submitToIndexNow(['https://blogs.redwan.work/post.html'], '');
      expect(res.status).toBe('skipped');
      expect(res.message).toContain('IndexNow Key not provided');
    });

    it('submits URLs to IndexNow endpoint successfully', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK'
      });
      vi.stubGlobal('fetch', fetchMock);

      const urls = ['https://blogs.redwan.work/2026/09/sample.html'];
      const res = await submitToIndexNow(urls, 'sample-indexnow-key', 'https://blogs.redwan.work/key.txt');

      expect(res.status).toBe('success');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.indexnow.org/indexnow');
      const body = JSON.parse(init.body);
      expect(body.host).toBe('blogs.redwan.work');
      expect(body.key).toBe('sample-indexnow-key');
      expect(body.keyLocation).toBe('https://blogs.redwan.work/key.txt');
      expect(body.urlList).toEqual(urls);
    });

    it('accepts HTTP 202 as successful submission', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        text: async () => 'Accepted'
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await submitToIndexNow(['https://blogs.redwan.work/post.html'], 'my-key');
      expect(res.status).toBe('success');
      expect(res.statusCode).toBe(202);
    });

    it('handles HTTP 403 error gracefully', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden: Key not valid'
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await submitToIndexNow(['https://blogs.redwan.work/post.html'], 'bad-key');
      expect(res.status).toBe('warning');
      expect(res.message).toContain('Key not valid');
      expect(res.statusCode).toBe(403);
    });
  });

  describe('submitUrlsToSearchEngines coordinator', () => {
    it('dispatches to both Bing and IndexNow when configured', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ d: null }),
        text: async () => 'OK'
      });
      vi.stubGlobal('fetch', fetchMock);

      const results = await submitUrlsToSearchEngines({
        urls: ['https://blogs.redwan.work/2026/09/sample.html'],
        bingApiKey: 'bing-key',
        indexNowKey: 'indexnow-key'
      });

      expect(results).toHaveLength(2);
      expect(results[0]!.engine).toBe('bing');
      expect(results[0]!.status).toBe('success');
      expect(results[1]!.engine).toBe('indexnow');
      expect(results[1]!.status).toBe('success');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('skips unconfigured engines without failing', async () => {
      const results = await submitUrlsToSearchEngines({
        urls: ['https://blogs.redwan.work/2026/09/sample.html']
      });

      expect(results).toHaveLength(2);
      expect(results[0]!.status).toBe('skipped');
      expect(results[1]!.status).toBe('skipped');
    });
  });
});
