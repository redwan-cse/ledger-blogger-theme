# Requirements intake, 2026-08-05

A batch of theme requirements arrived after M0 and M1 shipped and while M2 is in flight. This
document triages every item into an existing or new milestone, or rejects it against a binding
decision already recorded in `docs/PROJECT-PLAN.md`.

Nothing here changes M2 scope. M2 remains the render path and loud empty states.

---

## Rejected: contradicts a binding decision

These are not "not yet". They are decisions already made, with the rationale on record.

| Requirement | Conflict |
|---|---|
| AMP support | PROJECT-PLAN §1 non-goals: "No AMP, no Dynamic Views". AMP is a second render path and a second failure surface for a blog whose first render path just failed. |
| Disqus comments | §1 non-goals: "no third-party comment system". It makes reading depend on third-party JavaScript, which is finding F3 in a new costume. Native Blogger comments are M2 scope. |
| Light/dark theme toggle | OD-3: deferred past this release. Doubles the §2.6 state matrix and the predecessor's toggle caused FOUC. |
| Customizable colours and fonts via Theme Designer | §1 non-goals and §11: every Theme Designer variable is a surface for breaking the §2.2 contrast ratios. Colour and type are design decisions, not user settings. |
| Subtle page-load animations | Finding F3. Content is visible by default; scroll and load reveals were removed entirely, not fixed. |
| "Technical support" and "regular updates" | Not a software requirement. This is a noncommercial personal theme under PolyForm; there is no support contract to build. |

## Rejected pending evidence

| Requirement | Reason |
|---|---|
| Sidebar, two or three columns, 300-400px sidebar widgets | §2.4 specifies a single-column editorial layout with a 68ch measure. A sidebar contradicts the reading-first design and the "no uniform template" direction. Reopen only with a decision record that supersedes §2.4. |
| Show/hide sidebar option | Depends on the above. |
| Featured slider | A slider hides content behind JavaScript and interaction. A static lead post already fills this role in §2.4. A grid variant can be reconsidered in M3 with rendered evidence. |

---

## M2, currently in flight — no change

Render path, ten views, loud empty states, native Blogger comments, pagination.
The blank-render investigation blocks everything downstream.

## M3 — Design system

Already owned by M3, now with explicit numbers from this intake:

- Container width: target ~1200px maximum, honouring the 68ch reading measure inside it.
- Header band 80-100px, logo slot ~150x40px, nav aligned opposite the logo.
- Footer band 100-150px with copyright, credits, and useful links.
- Type scale 14px-36px, already specified in §2.3 as a 1.333 ratio scale.
- Neutral palette plus one accent, already specified in §2.2 as OKLCH tokens.
- Hover effects on navigation links, colour and opacity only, 120-200ms.
- Vector icons, inline SVG, `aria-hidden` when decorative.
- Featured area as a static lead block, full width, ~300-400px tall.

## M4 — Config zones

- Search widget, categories, popular posts, social links, newsletter block as **editable zones**,
  not a sidebar. These become Layout-editable sections per §3.2.
- Show/hide post date and author, driven by existing Blog widget settings.
- Show/hide social share icons.
- Support for custom widgets and dashboard-added gadgets, via `b:defaultmarkup` (already M4).
- Contact form, using Blogger's native ContactForm widget.

## M5 — SEO and accessibility

- Semantic markup, meta tags, descriptions, canonical URLs.
- Schema markup, already specified as JSON-LD `BlogPosting` in R-SEO-1.
- WCAG 2.2 AA, already R-A11Y-1 through R-A11Y-3.
- Social sharing buttons and correct share previews, R-SEO-2.
- Cross-browser compatibility within the supported matrix in §1.

## M6 — Performance

- Minified CSS and inline JS, already enforced by the generator.
- Responsive, compressed images via `resizeImage` and `sourceSet`, already R-PERF-1 AC6.
- Responsive embedded video and galleries, contained without widening the page.
- Lightweight and fast, already the Lighthouse and CLS/LCP budgets in R-PERF-1.

## M7 — Cutover

- Complete documentation, already the runbook and README requirements.
- Google Analytics integration, via the blog's own Analytics property ID setting.

## New: M8 — Reading experience

Small, post-page enhancements that need the render path to be stable first.

- Reading progress bar on posts. Progressive enhancement only; the article must be fully readable
  without it.
- "Back to top" button. Same rule.
- Related posts at the end of posts, server-rendered from labels where possible.
- Responsive hamburger navigation on small screens, implemented as a `<details>` disclosure so it
  works with JavaScript disabled, per §2.7.

## New: M9 — Monetisation and reach

Deliberately last, because both items can degrade the reading experience and both need a stable,
measured baseline to compare against.

- AdSense support, as bounded, non-blocking slots with reserved space to protect CLS.
- Multilingual support, starting with correct `lang` and `dir` and localised strings via
  `b:message`, rather than a translation widget.

---

## Sequencing rule

Nothing in M8 or M9 starts until M3 through M7 are complete and the production canary has been
green for 48 hours, per the §12 definition of done.
