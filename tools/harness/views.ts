import type { DiscoveredPost } from './blogger-api.js';
import type { HarnessAssertion } from './result.js';

export const viewNames = ['home-p1', 'home-p2', 'label', 'search', 'archive', 'post', 'static-page', 'empty-result', 'error', 'layout-mode'] as const;
export type ViewName = (typeof viewNames)[number];

export interface DiscoveredPage { url: string; title: string }
export interface ViewTarget { name: ViewName; url: string | null; requirementId: string; missingReason?: string }

export function createViewTargets(baseUrl: string, posts: readonly DiscoveredPost[], pages: readonly DiscoveredPage[], options: { olderUrl?: string; layoutModeUrl?: string } = {}): ViewTarget[] {
  const base = new URL(baseUrl);
  const post = posts[0];
  const labeled = posts.find((item) => item.labels.length > 0);
  const published = post?.published.slice(0, 7).replace('-', '/');
  const query = post?.title.split(/\s+/).find((part) => part.length >= 5);
  const target = (name: ViewName, url: string | null, requirementId: string, missingReason?: string): ViewTarget => ({ name, url, requirementId, ...(missingReason ? { missingReason } : {}) });
  return [
    target('home-p1', base.href, 'R-RENDER-1 AC1'),
    target('home-p2', options.olderUrl ?? null, 'R-RENDER-3 AC2', 'No older-page URL was discovered.'),
    target('label', labeled ? new URL(`search/label/${encodeURIComponent(labeled.labels[0] ?? '')}`, base).href : null, 'R-RENDER-1 AC3', 'No labeled post was discovered.'),
    target('search', query ? new URL(`search?q=${encodeURIComponent(query)}`, base).href : null, 'R-RENDER-1 AC3', 'No search term was discovered.'),
    target('archive', published ? new URL(`${published}/`, base).href : null, 'R-RENDER-1 AC3', 'No published post date was discovered.'),
    target('post', post?.url ?? null, 'R-RENDER-2 AC1', 'No post was discovered.'),
    target('static-page', pages[0]?.url ?? null, 'R-RENDER-4 AC1', 'No static page was discovered.'),
    target('empty-result', new URL('search?q=ledger-m0-guaranteed-empty-7f4c91', base).href, 'R-EMPTY-1 AC3'),
    target('error', new URL('__ledger-m0-missing-page__', base).href, 'R-EMPTY-1 AC4'),
    target('layout-mode', options.layoutModeUrl ?? null, 'R-V3-1 AC10', 'Layout mode is Google account login-gated; manual verification required.')
  ];

}

function mainText(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  return main.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&\w+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function assessView(target: ViewTarget, status: number, html: string): HarnessAssertion {
  if (!target.url) {
    return { requirementId: target.requirementId, status: 'SKIP', message: `${target.name} was not measured.`, evidence: target.missingReason ?? 'Precondition absent.' };
  }
  const text = mainText(html);
  const expects404 = target.name === 'error';
  const statusCorrect = expects404 ? status === 404 : status >= 200 && status < 400;
  const visible = text.length >= 40;
  const stateClassRequired = target.name === 'empty-result' || target.name === 'error';
  const stateVisible = !stateClassRequired || /class=(['"])[^'"]*empty-state[^'"]*\1/i.test(html);
  const passed = statusCorrect && visible && stateVisible;
  return {
    requirementId: target.requirementId,
    status: passed ? 'PASS' : 'FAIL',
    message: `${target.name}: HTTP ${status}, main visible text ${text.length} chars${stateClassRequired ? `, empty-state ${stateVisible ? 'present' : 'missing'}` : ''}.`,
    evidence: target.url
  };
}
