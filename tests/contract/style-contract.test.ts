import { describe, expect, it } from 'vitest';
import { findFocusSuppression, findHiddenPostContent, findScrollTriggeredMotion } from '../../tools/style-contract.js';

describe('style-contract — no-focus-suppression', () => {
  it('flags outline:none', () => {
    expect(findFocusSuppression('a:focus{outline:none}')).toBe(true);
  });

  it('does not flag a custom :focus-visible outline', () => {
    expect(findFocusSuppression(':focus-visible{outline:2px solid red;outline-offset:2px}')).toBe(false);
  });

  it('does not flag unrelated CSS with no outline property at all', () => {
    expect(findFocusSuppression('.btn{border-style:solid}')).toBe(false);
  });
});

describe('style-contract — no-hidden-post-content (R-EMPTY-2 AC2)', () => {
  it('flags display:none on .post-title', () => {
    expect(findHiddenPostContent('.post-title{display:none}')).toEqual(['.post-title']);
  });

  it('flags opacity:0 on .article-body', () => {
    expect(findHiddenPostContent('.article-body{opacity:0}')).toEqual(['.article-body']);
  });

  it('flags visibility:hidden on a comma-separated post selector', () => {
    expect(findHiddenPostContent('.post-row,.post-title{visibility:hidden}')).toEqual(['.post-row,.post-title']);
  });

  it('allows opacity:0 inside a :hover state', () => {
    expect(findHiddenPostContent('.post-actions:hover{opacity:0}')).toEqual([]);
  });

  it('allows a [hidden] attribute selector', () => {
    expect(findHiddenPostContent('.post-row[hidden]{display:none}')).toEqual([]);
  });

  it('does not flag an unrelated selector that merely contains the substring "post"', () => {
    expect(findHiddenPostContent('.footer-postscript{opacity:.5}')).toEqual([]);
  });

  it('does not flag non-zero opacity', () => {
    expect(findHiddenPostContent('.post-title{opacity:.8}')).toEqual([]);
  });

  it('allows the one documented exception, .post-excerpt, exact match only', () => {
    expect(findHiddenPostContent('.post-excerpt{display:none}')).toEqual([]);
  });

  it('does not extend the documented exception to selectors that merely start with it', () => {
    expect(findHiddenPostContent('.post-excerpt-widget{display:none}')).toEqual(['.post-excerpt-widget']);
  });
});

describe('style-contract — no-scroll-triggered-motion (F3)', () => {
  it('flags animation-timeline: scroll()', () => {
    expect(findScrollTriggeredMotion('.x{animation-timeline:scroll()}')).toBe(true);
  });

  it('flags a known reveal-library hook class', () => {
    expect(findScrollTriggeredMotion('.reveal{opacity:1}')).toBe(true);
  });

  it('does not flag an ordinary hover transition', () => {
    expect(findScrollTriggeredMotion('.post-title:hover{transition:color 160ms}')).toBe(false);
  });

  it('does not flag an unrelated selector that merely contains "reveal" as a substring of a longer word', () => {
    expect(findScrollTriggeredMotion('.unrevealed-count{color:red}')).toBe(false);
  });
});
