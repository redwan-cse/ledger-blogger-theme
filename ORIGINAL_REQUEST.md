# Original User Request

## 2026-08-15T08:26:51Z

Complete Milestone M3 (Design System) of the Ledger Blogger Theme, integrate and fix all platform, binding, and contract bugs from M0 through M3, and build the production-ready theme with all required Header and Blog widget includables.

Working directory: j:/DevDrive/ledger-blogger-theme
Integrity mode: development

## Requirements

### R1. Theme Generation & V3 Contract Conformance
- Generate `dist/theme.xml` from Pug, SCSS, and TypeScript sources strictly adhering to Blogger Layouts V3 (`b:layoutsVersion='3'`) and Widget Version 2 (`version='2'`).
- Enforce all 22 contract rules in `tools/contract-check.ts` (namespaces, single CDATA skin, alphanumeric/underscore section IDs `header` and `page_body`, bound widget IDs `Header1` and `Blog1`, banned V2 constructs, `.jsonEscaped` on JSON-LD interpolations, contrast ratios, and style constraints).
- Fix `tools/build-controls.ts` to match `Blog1` and `tools/golden-check.ts` to handle CRLF/LF line-endings reliably on Windows and CI.

### R2. M3 Design System & Modular SCSS
- Split SCSS into the modular architecture defined in `docs/PROJECT-PLAN.md §3.3` (`tokens.scss`, `base.scss`, `layout.scss`, `index.scss`, `article.scss`, `states.scss`, `main.scss`).
- Enforce OKLCH colour tokens and automated WCAG contrast validation (Body Ink >= 7:1, Accent >= 4.5:1 on warm paper page).
- Implement 12-column responsive layout (single column <640px, tablet 640-1024px, 12 columns >1024px) with lead-post excerpt display on homepage page 1 and compact row listing on subsequent posts.
- Complete style rules for all state matrix views (posts list, empty search, empty label, empty archive, 404 error state, comment threading with tombstones, and accessible pagination) without external CSS dependencies or JavaScript display requirements (`R-EMPTY-2 AC2`).

### R3. Header & Blog Widget Includables & Error Resolution (M0–M3)
- Fully populate Header and Blog widget includables matching the Layouts V3 contract (`main`, `post`, `postTitle`, `postHeader`, `postBody`, `postBodySnippet`, `postFooter`, `comments`, `threadedComments`, `threadedCommentForm`, `status-message`, `postPagination`).
- Eliminate reliance on `super.main` fallback so the theme renders cleanly without missing `defaultmessages` dependencies.
- Ensure all 10 views (Home p1, Home p2+, Label, Search, Archive, Post, Static Page, Empty Result, Error 404, Layout Mode) contain valid V3 XML tags.
- Remove any `continue-on-error` or `|| true` in CI workflows.

## Acceptance Criteria

### Automated Verification
- [ ] `npm run generate` succeeds and generates `dist/theme.xml` under 200 KB.
- [ ] `npm run test:contract` passes all contract and style tests.
- [ ] `npm run test:golden` passes snapshot validation.
- [ ] `npm run contract:check` passes all 22 V3 contract rules.
- [ ] `npm run typecheck` passes with zero TypeScript diagnostics.
- [ ] `npx tsx tools/build-controls.ts` successfully creates control files without widget mismatch errors.

### Theme & Widget Readiness
- [ ] All 10 views contain valid V3 XML tags and render without JavaScript dependencies.
- [ ] Golden snapshot and build controls are updated and verified for M4 readiness.

## 2026-08-15T17:12:20Z

Perform a final rigorous multi-agent audit and readiness check across Milestones M0 through M3:
1. Verify all M0, M1, M2, and M3 exit criteria from docs/PROJECT-PLAN.md are completely satisfied.
2. Confirm dist/theme.xml, 22 contract rules, golden snapshot, TypeScript typecheck, build controls, and offline unit/harness test suites are 100% green.
3. Audit repository readiness to begin Milestone M4 (Config Zones & Defaultmarkups).
Report back with an exhaustive milestone-by-milestone verification scorecard.
