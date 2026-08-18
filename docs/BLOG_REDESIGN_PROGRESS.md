# Ledger Blogger Theme — redesign progress

## Status: implementation complete, live acceptance blocked

The generated theme is offline-green and Blogger renders real posts, articles, comments, pagination, CTA, footer, labels, and sidebar. It is **not production-ready or fully verified** until the newest exact-SHA artifact passes the live M2–M6 workflow.

## Implemented

- Layouts V3 shell with explicit Widget V2 declarations, load-bearing defaultmarkups, and no `maxwidgets`.
- Header, navigation, responsive drawer/search, hero, topics, post stream, sticky sidebar, article reading layout, code controls, share bar, author fallback, post navigation, comments, CTA, and footer.
- Dark/light palettes, wrapper-chain fixes, 1280px desktop shell, 9/3 stream/sidebar split, 68ch article measure, tightened article/comments rhythm, and stronger dark-mode metadata contrast.
- Deterministic Pug/SCSS/TypeScript generation, namespace-aware contract checks, golden snapshot, unit/contract suites, exact-SHA deploy gate, ten-view HTTP/browser harness, axe suite, Lighthouse home/post budgets, release artifacts, and six-hour production canary.

## Current verified evidence

- CI on the latest implementation lineage is green for typecheck, unit tests, contract tests, contract check, generation, golden snapshot, and size budget.
- Earlier live screenshots confirmed rendering and exposed the UI defects addressed by issues #15, #16, and #18.
- The prior pagination/share encoding artifacts no longer reproduce.

## Blocked acceptance

- Upload the newest `dist/theme.xml` to Blogger and preserve its full `theme-build` SHA.
- If Google returns `invalid_grant`, reauthorize Blogger OAuth and replace only the `BLOGGER_REFRESH_TOKEN` secret in the `blogger-live` GitHub environment.
- Dispatch `M2 staging validation` with the uploaded full SHA.
- Require PASS across deploy stamp, ten views, JS/no-JS/reduced-motion, Layout mode, axe, and Lighthouse. BLOCKED or STALE is not PASS.
- Capture light/dark screenshots at 375, 768, and 1440 before closing #14, #15, #16, and #18.
- Add/remove one real dashboard gadget and measure CLS before closing #13.

See `docs/MASTER-PLAN-v2.md` for the authoritative sequence and acceptance rules.
