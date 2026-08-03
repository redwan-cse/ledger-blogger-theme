import { describe, expect, it } from 'vitest';
import { assessView, createViewTargets, viewNames } from '../../tools/harness/views.js';

const posts = [{ id: '1', url: 'https://example.blogspot.com/post.html', title: 'Evidence based testing', content: '<p>body</p>', labels: ['Red Teaming'], published: '2026-08-03T00:00:00Z', updated: '2026-08-03T00:00:00Z' }];

describe('ten-view harness plan', () => {
  it('always represents every required view exactly once', () => {
    const targets = createViewTargets('https://example.blogspot.com/', posts, [{ url: 'https://example.blogspot.com/p/about.html', title: 'About' }], { olderUrl: 'https://example.blogspot.com/search?updated-max=x', layoutModeUrl: 'https://www.blogger.com/blog/layout/1' });
    expect(targets.map((target) => target.name)).toEqual(viewNames);
    expect(new Set(targets.map((target) => target.url)).size).toBe(10);
  });

  it('marks an unavailable precondition SKIP with evidence', () => {
    const target = createViewTargets('https://example.blogspot.com/', [], [])[1];
    expect(assessView(target!, 0, '').status).toBe('SKIP');
    expect(assessView(target!, 0, '').evidence).toContain('older-page');
  });

  it('fails a blank main for the render reason, not XML shape', () => {
    const target = createViewTargets('https://example.blogspot.com/', posts, [])[0]!;
    const result = assessView(target, 200, '<html><main></main></html>');
    expect(result.status).toBe('FAIL');
    expect(result.message).toContain('0 chars');
  });

  it('requires an HTTP 404 and loud empty state on the error view', () => {
    const target = createViewTargets('https://example.blogspot.com/', posts, [])[8]!;
    expect(assessView(target, 200, '<main class="empty-state">This content is deliberately longer than forty visible characters.</main>').status).toBe('FAIL');
    expect(assessView(target, 404, '<main><div class="empty-state">This content is deliberately longer than forty visible characters.</div></main>').status).toBe('PASS');
  });
});
