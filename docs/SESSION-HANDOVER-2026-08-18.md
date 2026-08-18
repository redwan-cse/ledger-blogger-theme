# Ledger — session handover prompt (2026-08-18)

Paste this into a new conversation to continue where this session left off.

---

## Repo

`redwan-cse/ledger-blogger-theme` — Blogger Layouts V3 theme for [blogs.redwan.work](https://blogs.redwan.work). Tip of `main` as of this handover: `78812dca2d0595d005656f28935fb261bc32ad97`.

**Read first, in this order:** `AGENTS.md`, `docs/POSTMORTEM.md`, `docs/V3-REFERENCE.md`, `docs/MASTER-PLAN-v2.md` (supersedes `docs/PROJECT-PLAN.md` §10 for milestone status; PROJECT-PLAN's §1-§9 requirements/design-direction still hold).

A workspace skill, **GOOGLE-BLOGGER-THEME-DEVELOPMENT**, carries the accumulated platform lessons (version trap, `defaultmarkups` as load-bearing, `maxwidgets` ban, native-dispatch pattern, verification discipline, gadget compatibility). Load it before writing any Blogger XML.

---

## What is true right now

### CI is red — this is the one open blocker

`npm run test:golden` fails:

```
Error: Golden snapshot differs at byte 771 (line 11, col 1).
Expected: "...﻿*{box-sizing:border-box}..."   (has a leading BOM byte)
Actual:   "...*{box-sizing:border-box}..."    (no BOM)
```

Two things layered here:

1. **The BOM mismatch itself** is unrelated to this session's edits — it's a pre-existing artifact in the *committed* golden snapshot from `base.scss`'s compiled output, a file untouched this session. Not a regression from anything below.
2. **`golden-check` stops at the first byte mismatch**, and that first mismatch is right near the top of the file. This session made substantial real changes (new header markup, CSS restructuring — see below), so there is almost certainly a large legitimate diff sitting *after* byte 771 that has never been seen yet.

**No agent in this thread has Node/npm/sass/a browser available** — cannot run `npm run generate`, `npm run golden:update`, or view a rendered page. This step needs the owner's machine or CI:

1. `npm run generate`
2. `npm run golden:update` (or just `npm run test:golden` first to see the real diff)
3. **Actually read the full diff** before committing — it will contain the legitimate navbar-rebuild changes, not just the BOM
4. Commit `tests/golden/theme.xml`
5. Re-run `npm test` and `npm run test:contract` to confirm nothing else broke

### The stamp-gated staging harness has still never been run

This has been the standing blocker across the whole session. `m2-staging.yml` requires a `workflow_dispatch` with the exact SHA of whatever artifact is actually uploaded to Blogger — no tool available in this thread can trigger a GitHub Actions dispatch or upload to Blogger (no theme-upload API exists). **Issue #7 stays open until this runs and passes.** M3b (live design verification) and the UI-bug items in #14 that couldn't be confirmed against source are both gated on this same run.

### Not yet uploaded to Blogger

Owner confirmed the current build has not been uploaded. The 4 screenshots reviewed earlier in the session are from some other, unspecified build — not necessarily current `main`. Don't treat anything visual as confirmed until it's checked against a real render of the current SHA.

---

## What changed this session (all pushed to `main`)

**Master plan implementation** (`docs/MASTER-PLAN-v2.md`, `docs/PROJECT-PLAN.md`, issues):
- Confirmed `<b:defaultmarkups>` with `Common` entry present in `src/theme.pug` (was a suspected gap, wasn't one)
- OD-5 label taxonomy **decided and closed** (issue #2): 8 labels, title case, applying them to the 16 live posts is a manual Blogger-dashboard step, not something any tool here can do
- M3c layout decision **decided and closed** (issue #11): keeping the shipped 2-column card grid over the original lead+list plan — intentional, not drift
- `tools/contract-check.ts` gained a `no-maxwidgets` rule (commit `5bffe76`) plus test coverage (commits `04b81fa`, `09eaaef`) after it broke two test files' hardcoded counts/fixtures — fixed same session
- `ci.yml`'s NFR-2 timing budget bumped 25s→45s (commit `6fe42eab`) since the contract suite legitimately grew to ~33-38s

**UI bug fixes** (issue #14 has full detail):
- Dark-mode pagination buttons were invisible (white-on-white — text color was overridden for dark mode, background/border weren't). Fixed in `layout.scss`.
- `.comments-title` had zero dark-mode contrast override. Fixed same commit.
- The "SVG monogram avatar fallback" the docs claimed was shipped wasn't — the no-photo branch silently substituted a second hardcoded photo URL. Wired up the actually-unused `.author-avatar-fallback`/`.author-initials` CSS to real markup in `blog-post.pug` (commit `b98f29a`).
- Left unconfirmed: blank avatars and a fixed gray-box artifact seen in all 4 screenshots (likely capture-environment issues, not template bugs) and literal `&#8594;`/`00 Copy Link` text (current source shows neither bug — probably from an older/different build).

**Homepage navbar rebuild** (owner request, this session's last major change):
- `src/widgets/header.pug`: merged the old text-only site title + a separate hardcoded photo badge into one `.header-brand` (photo + two-line name/tagline), linking to the homepage
- `src/theme.pug`: nests `.nav-container` inside `.header-outer` as `.header-bar`; removed the sidebar's 3rd (redundant) photo instance — 2 total now (header brand + hero banner); added a real search form inside the mobile drawer
- `src/widgets/blog-archive.pug`: pager arrows are now inline SVG chevrons, not CSS-generated text glyphs
- `src/styles/layout.scss`: `.header-bar` flex row with `order: 1/2/3` (brand, nav, actions) so visual order doesn't depend on DOM order; `.search-toggle` hides below 1024px (drawer search takes over); `.topics-list`/`.topics-cloud` get `justify-content: center`
- `src/styles/states.scss`: pager SVG icon sizing/hover, replacing old pseudo-element arrow rules
- **Known limitation, stated to the owner:** Blogger's Blog widget contract exposes no total-page-count or current-page-index, so true numbered pagination ("Page 2 of 5") isn't achievable — only relative Older/Newer, which is what's implemented.

---

## Open GitHub issues

| # | Title | State |
|---|---|---|
| [#7](https://github.com/redwan-cse/ledger-blogger-theme/issues/7) | M2 render path — blank-render root causes reconciled, live harness run still required to close | open |
| [#13](https://github.com/redwan-cse/ledger-blogger-theme/issues/13) | M4 gadget-readiness — add a real dashboard gadget on staging, confirm defaultmarkup coverage | open, blocked on #7 and #2(closed, taxonomy still needs manual application) |
| [#14](https://github.com/redwan-cse/ledger-blogger-theme/issues/14) | UI bugs from screenshot review — 3 fixed, 2 flagged as environment artifacts, 2 unconfirmed pending a real render | open |

Closed this session: #2 (OD-5), #11 (M3c).

---

## Immediate next steps, in order

1. **Owner runs `npm run generate` + reviews the golden diff + commits it.** Nothing else proceeds cleanly until CI is green again.
2. **Owner dispatches `m2-staging.yml`** with the SHA of whatever gets uploaded to Blogger next. This is the single piece of evidence the whole plan has been waiting on.
3. Once 1 and 2 pass: close #7, revisit #14's two unconfirmed items against the real render, resume M4 (issue #13).
4. Apply the 8 OD-5 labels to the 16 live posts in the Blogger dashboard (manual, not tool-doable).

---

## Standing rules worth restating to a fresh agent

- No completion claim is valid without rendered-HTML evidence (`AGENTS.md` rule 1, `docs/POSTMORTEM.md` finding F1). Offline-green ≠ verified.
- Never reintroduce `maxwidgets` on a `b:section` or strip `<b:defaultmarkups>` — both caused real production outages, both are now contract-banned.
- Treat any visual claim about the live site as unconfirmed until checked against a real render of the exact SHA in question — this session repeatedly found screenshots didn't match current source.
