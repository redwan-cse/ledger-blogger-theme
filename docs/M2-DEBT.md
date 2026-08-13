# M2 debt: the render path is merged but NOT verified

**Status:** open · **Owner decision, 2026-08-13** · **Tracking:** issue #7

## What was decided

M2 was merged to `main` with its exit criteria unmet, so that M3 design work is not blocked
behind an unsolved platform bug. This was an explicit owner decision, taken against the
recommendation to keep M2 on its branch.

**M2 is not complete. Nothing in it is accepted.**

## What is actually true on production

`https://blogs.redwan.work/` renders the site title and tagline and **zero posts**, verified
2026-08-13 against the artifact built from `8dde01f6e4a4dacef11089798da292e70d68a9c8`. That is
the sixth consecutive blank upload.

| M2 exit criterion | State |
|---|---|
| Header + Blog widgets against the full includable contract | XML written, execution unproven |
| All ten views render | **Unverified.** Zero views proven. |
| R-RENDER passes with JS disabled | **Unverified** |
| R-EMPTY passes with JS disabled | **Unverified** |
| Comment rendering verified (RK-2) | **Unverified** |
| Every `continue-on-error` removed | Done, enforced by CI source audit |

Only the last row is met.

## The consequence nobody should forget

Every milestone after M2 is accepted on rendered-HTML evidence. While the render path is dead,
**M3 through M9 cannot be verified live either.** M3 work must therefore be treated as
provisional: written, reviewed, contract-tested, golden-snapshotted, and explicitly *not*
accepted until the render path is fixed and M3's visual baselines can be captured against real
Blogger HTML.

Do not let a green PR gate read as a working feature. That confusion is finding F1 and it has now
cost this project nine days twice over.

## Debt to repay before M5

Repay after M3, or after M4 at the very latest. Shipping M5 (SEO and a11y, both verified against
rendered HTML) on an unrendered theme is not possible.

1. **Diagnose the blank render.** Next step is the round-trip export diff described in
   [ADR 0001 § Falsification](decisions/0001-blogger-owns-widget-bindings.md#falsification-2026-08-13).
   Do this before writing any more widget code.
2. Run stamp-gated staging validation across all ten views, in HTTP, no-JS, and reduced-motion
   contexts.
3. Confirm Layout mode renders and both sections are populated.
4. Verify comment rendering, closing RK-2 and OD-7.
5. Restore any M2 scope stripped during the bisect: complete includable inventory, one
   `.post-lead` on home page 1, threaded comments with tombstones and "Anonymous", five-recent-post
   recovery lists on empty search and 404, static pages free of post-only chrome.
6. Update README and `docs/HARNESS.md` to verified behaviour, then close issue #7.

## Standing rule, unchanged

No completion claim is valid until a stamp-gated staging run passes all ten views. BLOCKED and
STALE are inconclusive and are never reported as a pass.
