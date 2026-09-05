# Ledger Blogger Theme — redesign progress

## Status: v1.4.0 verified and deployed live

The generated theme is offline-green and verified live on production at [blogs.redwan.work](https://blogs.redwan.work/). Blogger renders real posts, articles, comments, pagination, CTA, footer, labels, and sidebar with zero layout shifts and instant local cache hydration.

## Implemented in v1.4.0

- Audio article narration engine (`SpeechSynthesis`) with sentence-boundary chunking, responsive desktop inline/mobile wrap, and cycling speed controls (`0.5x` to `1.5x`).
- Mathematical optical center alignment across post byline metadata, avatar, reading time badge, and audio control buttons (`centerY = 78.0px` / `426.86px`).
- Inline vector SVG stopwatch icon replacing colored OS emoji, eliminating platform baseline discrepancies.
- Compact micro-pill tag sizing (`21.2px` height, `4px` border radius, `2px 8px` padding) overriding 44px touch target inflation on post cards and footer.
- Autonomous author avatar protection preventing diagram thumbnails from replacing author face images across all older and newer articles.
- Context-aware search routing dynamically targeting homepage filter bar vs single article sidebar search.
- Zero-layout-shift micro-instant `localStorage` hydration for recent publications in sidebar and drawer.

## Current verified evidence

- CI is green across typecheck, unit tests, contract tests, contract check, generation, golden snapshot, and size budget.
- Live production blog [blogs.redwan.work](https://blogs.redwan.work/) verified via Chrome DevTools DOM evaluation:
  - `.label-link` height is 21.2px with 2px 8px padding and 4px border radius.
  - Post header metadata elements share an exact `centerY = 426.86px`.
  - Author avatars display author face across older and newer articles.
  - Sidebar search input is dynamically visible on single posts and hidden on homepage.

See `docs/MASTER-PLAN-v2.md` for the authoritative sequence and acceptance rules.
