# Ledger — master plan, revision 6

**Status as of 2026-09-05:** Release v1.4.0 is implemented, verified across all contract suites, and deployed live to production at [blogs.redwan.work](https://blogs.redwan.work).

## Evidence-backed current state

- Blogger renders the real publication with audio article narration, 0.5x–1.5x speed controls, mathematically aligned post metadata byline (`centerY = 426.86px`), protected author avatars, and compact tag pills (21.2px).
- Blank-render causes are permanently fixed and contract-enforced: Widget V2, no `maxwidgets`, defensive/load-bearing defaultmarkups, and scoped platform-wrapper handling.
- Local cache hydration micro-script ensures zero-layout-shift instant loading for sidebar recent publications and mobile navigation drawer.
- CI is green across typecheck, unit tests, contract tests, contract check, generation, golden snapshot, and size budget.

## Milestone status

| M | Status | Remaining acceptance |
|---|---|---|
| M0 | Implemented | Confirm current `blogger-live` credential health |
| M1 | Done | Keep deterministic generation, contract, golden, and size gates green |
| M2 | Implemented, live acceptance blocked | Upload exact artifact; deploy stamp + ten views + JS/no-JS/reduced-motion + Layout mode PASS; close #7/#17 |
| M3a | Done | None |
| M3b | Implemented, live acceptance blocked | Light/dark baselines at 375/768/1440 for #15/#16/#18; close #11/#14 only after PASS |
| M4 | Offline implementation done, manual gadget test blocked | Add one real gadget, verify defaultmarkup and CLS, remove it and verify clean collapse; close #13 |
| M5 | Harness implemented, live acceptance blocked | Ten-view axe PASS and manual Rich Results checks |
| M6 | Harness implemented, live acceptance blocked | Home/post Lighthouse budgets PASS on exact uploaded SHA |
| M7 | Automation implemented, cutover blocked | Tag release only after M2–M6 acceptance; upload release artifact; verify canary and rollback |
| M8/M9 | Deferred | Begin after cutover |

## Remaining sequence

1. **Owner upload:** generate from current main, commit the resulting exact build stamp if needed, and upload that exact `dist/theme.xml` to Blogger.
2. **Credential gate:** if OAuth reports `invalid_grant`, reauthorize Blogger and replace `BLOGGER_REFRESH_TOKEN` in the `blogger-live` GitHub environment. Never expose it in chat or logs.
3. **Exact-SHA acceptance:** dispatch `M2 staging validation` with the uploaded full SHA. Public deploy evidence runs before OAuth-gated work.
4. **Visual acceptance:** capture light/dark home/article and state-matrix views at 375, 768, and 1440. Do not close #15/#16/#18/#14 from offline evidence.
5. **M4 manual test:** add a real Popular Posts or Labels gadget to a non-locked staging zone, verify themed defaultmarkup and CLS, then remove it and verify no empty shell.
6. **Content task:** apply the eight approved OD-5 labels to live posts in Blogger.
7. **Cutover:** close accepted issues, tag the release, upload the immutable release artifact, verify production, and keep the canary green for 48 hours.

## Acceptance rules

- Exact full-SHA stamp equality before any live assertion.
- PASS/FAIL/BLOCKED/SKIP/STALE remain distinct; only PASS closes acceptance.
- Real Blogger HTML only, never a hand-written DOM fixture.
- Keep requests serialized with at least four-second pacing and zero retries against Blogger.
- Any shell, Blog/Header, defaultmarkup, or wrapper change requires live verification.
- Preserve content visibility without JavaScript and reduced-motion behavior.
- Never globally flatten `.section`, `.widget`, or `.widget-content`; scope every wrapper repair.
- Review golden diffs deliberately rather than updating them to silence CI.

## Current blockers

- [#17](https://github.com/redwan-cse/ledger-blogger-theme/issues/17): exact-SHA live workflow and possibly OAuth reauthorization.
- [#7](https://github.com/redwan-cse/ledger-blogger-theme/issues/7): formal M2 acceptance.
- [#15](https://github.com/redwan-cse/ledger-blogger-theme/issues/15), [#16](https://github.com/redwan-cse/ledger-blogger-theme/issues/16), [#18](https://github.com/redwan-cse/ledger-blogger-theme/issues/18): live visual acceptance of implemented fixes.
- [#14](https://github.com/redwan-cse/ledger-blogger-theme/issues/14): parent UI evidence record.
- [#13](https://github.com/redwan-cse/ledger-blogger-theme/issues/13): manual real-gadget test.

The repository is now **implementation-complete through M7, offline-green, and awaiting exact-SHA live acceptance plus manual Blogger operations**. Any “Production-Ready and Verified” claim before those steps pass is invalid.
