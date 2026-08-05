import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
const required = ['main','post','postBody','postBodySnippet','postTitle','postHeader','postMeta','postFooter','postFooterAuthorProfile','postJumpLink','postPagination','postCommentsAndAd','postCommentsLink','nextPageLink','previousPageLink','homePageLink','feedLinks','feedLinksBody','inlineAd','comments','commentsTitle','commentList','commentItem','commentForm','commentFormIframeSrc','commentAuthorAvatar','commentDeleteIcon','commentPicker','threadedComments','threadedCommentForm','threadedCommentJs','addComments','aboutPostAuthor','status-message'] as const;
function blogWidget(xml: string): string { const match = xml.match(/<b:widget id="Blog1"[\s\S]*?<\/b:widget>/); if (!match) throw new Error('Blog1 widget was not generated.'); return match[0]; }

describe('M2 render-path contract', () => {
  it('declares every required Blog includable exactly once', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    for (const id of required) { const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); expect(widget.match(new RegExp(`<b:includable id="${escaped}"(?:\\s|/|>)`, 'g')) ?? [], id).toHaveLength(1); }
  });
  it('emits the full post body only through postBody', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget.match(/<data:post\.body\/>/g) ?? []).toHaveLength(1);
    expect(widget).toMatch(/<b:includable id="postBody" var="post">[\s\S]*?<data:post\.body\/>[\s\S]*?<\/b:includable>/);
  });
  it('renders exactly one homepage lead path and a row fallback', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget.match(/class="post-lead"/g) ?? []).toHaveLength(1);
    expect(widget.match(/class="post-row"/g) ?? []).toHaveLength(1);
    expect(widget).toContain('data:view.isHomepage and not data:newerPageUrl and data:i == 0');
  });
  it('keeps post-only chrome behind data:view.isPost', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget).toMatch(/<b:if cond="data:view\.isPost">[\s\S]*?<div class="share-bar">[\s\S]*?<div class="related">[\s\S]*?<div class="reading-progress">/);
  });
  it('implements server-side comment threading and recovery lists', async () => {
    const widget = blogWidget((await generateTheme({ sha, write: false })).xml);
    expect(widget).toContain('data:post.comments filter (c =&gt; not data:c.inReplyTo)');
    expect(widget).toContain('data:post.comments filter (c =&gt; data:c.inReplyTo == data:root.id)');
    expect(widget).toContain('class="comment-tombstone"');
    expect(widget).toContain('data:i &lt; 5');
    expect(widget.match(/<b:include data="data:widgets\.Blog\.first\.posts" name="recentList"\/>/g) ?? []).toHaveLength(2);
  });
  it('uses the documented Posts section id and loud states', async () => {
    const xml = (await generateTheme({ sha, write: false })).xml;
    expect(xml).toContain('<b:section id="main"');
    expect(xml).toContain('class="empty-state"');
    expect(xml).toContain('data:view.isError');
  });
});
