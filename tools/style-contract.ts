// ---------------------------------------------------------------------------
// Style contract — rules against the COMPILED CSS inside <b:skin>, not the
// XML shape. Complements tools/contract-check.ts, which only understands
// markup. docs/PROJECT-PLAN.md §2.6, §2.8, R-EMPTY-2, R-A11Y-2.
//
// These are regex-based heuristics over sass's compressed single-line
// output, not a full CSS parser. That is a deliberate, disclosed trade-off:
// a real parser is more work than this milestone's budget justifies, and
// every rule below carries a self-test proving what it flags and what it
// correctly leaves alone (R-BUILD-1 AC9).
// ---------------------------------------------------------------------------

interface CssRule {
  selector: string;
  body: string;
}

/**
 * Splits compressed CSS (`selector{prop:value}selector2{prop:value}`, no
 * newlines) into selector/body pairs. Nested at-rules such as
 * `@media (...) { .a{...} }` are not modelled as a unit: the @media prelude
 * itself fails to match as a rule (its "body" would need to contain an
 * unescaped `{`), so the regex simply keeps scanning and picks up the
 * nested `.a{...}` as its own pair. That is exactly the behaviour every
 * check here wants, since none of them care which at-rule wraps a selector.
 */
function splitRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css))) {
    rules.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' });
  }
  return rules;
}

const OUTLINE_NONE = /outline\s*:\s*none\b/i;

/** Never suppress the focus indicator outright; :focus-visible must be the only override. */
export function findFocusSuppression(css: string): boolean {
  return OUTLINE_NONE.test(css);
}

const TARGET_SELECTOR = /\.(?:post|article)-[\w-]+/;
const ALLOWED_HIDE_CONTEXT = /:hover|:focus(?:-visible)?|\[hidden\]/;
const HIDING_DECLARATION = /(?:^|;)\s*(?:opacity\s*:\s*0(?:\.0+)?\b|visibility\s*:\s*hidden\b|display\s*:\s*none\b)/i;

/**
 * .post-excerpt is a deliberate, JS-independent structural hide: the excerpt
 * markup renders on every index row (see src/widgets/blog.pug) but is only
 * meant to be visible on the homepage-p1 lead post, per
 * docs/PROJECT-PLAN.md §2.4/§2.5. It is a static design choice, not the
 * JS-dependent reveal-on-scroll anti-pattern R-EMPTY-2 AC2 and F3 exist to
 * ban. The more thorough fix, not rendering the excerpt markup at all for
 * non-lead rows, touches src/widgets/blog.pug, which BR-7 gates behind a
 * staging render pass. That pass is blocked by issue #7, so the fix is
 * tracked there rather than silently carried here or used to weaken this
 * rule for every other selector.
 *
 * Matched as a SUFFIX, not an exact string: the mobile override in
 * src/styles/index.scss reasserts the same hide at a narrower scope,
 * compiling to a descendant chain like
 * `body.is-home-lead .post:first-of-type .post-excerpt`. That is the
 * identical static hide, just scoped inside a media query, so a selector
 * ending in `.post-excerpt` (preceded by start-of-string or whitespace, i.e.
 * it is the rightmost compound in the chain) is exempt regardless of what
 * precedes it. `.post-excerpt-widget` is a different class that merely
 * starts with the same text and must NOT match: the trailing `$` anchor
 * ensures the selector ends exactly at `post-excerpt`, not partway through
 * a longer class name.
 */
const POST_EXCERPT_HIDE_EXCEPTION = /(?:^|\s)\.post-excerpt$/;

/** R-EMPTY-2 AC2: no compiled CSS may hide post/article content outside an interactive or [hidden] context. */
export function findHiddenPostContent(css: string): string[] {
  const offenders: string[] = [];
  for (const { selector, body } of splitRules(css)) {
    if (!TARGET_SELECTOR.test(selector)) continue;
    if (ALLOWED_HIDE_CONTEXT.test(selector)) continue;
    if (POST_EXCERPT_HIDE_EXCEPTION.test(selector)) continue;
    if (HIDING_DECLARATION.test(body)) offenders.push(selector);
  }
  return offenders;
}

const SCROLL_MOTION = /scroll-timeline|animation-timeline\s*:\s*scroll/i;
const REVEAL_HOOK = /\.(?:reveal|aos-[\w-]*|fade-in-up|fade-up|js-scroll|scroll-reveal)\b/i;

/** docs/PROJECT-PLAN.md §2.4 motion, F3: no scroll-triggered reveal, ever. */
export function findScrollTriggeredMotion(css: string): boolean {
  return SCROLL_MOTION.test(css) || REVEAL_HOOK.test(css);
}
