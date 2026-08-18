# Ledger — master plan, revision 3

**Status as of 2026-08-18.** This document reconciles the AGY (Antigravity) premium-redesign
work in `docs/AGY-PROMPT-PREMIUM-REDESIGN.md` and `docs/BLOG_REDESIGN_PROGRESS.md` against
the project's own verification standard (`AGENTS.md`, `docs/POSTMORTEM.md`,
`docs/PROJECT-PLAN.md`), the actual GitHub issue/commit history, and outside research on
Blogger widget integration and editorial UI/UX. It supersedes the milestone table in
`docs/PROJECT-PLAN.md` §10 and the open status of `docs/M2-DEBT.md`. It does not replace
`PROJECT-PLAN.md` §1–§9 (scope, design direction inputs, requirements, testing strategy),
which still hold.

---

## 1. What is actually true right now

### 1.1 The blank-render saga has two real root causes, not one

Three separate documents in this repo currently disagree about why the site rendered blank,
because they were written at different points in a nine-day investigation:

| Document | Hypothesis | Outcome |
|---|---|---|
| `docs/decisions/0001-blogger-owns-widget-bindings.md` (2026-08-13) | Widget/section id mismatch with Blogger's stored bindings | **Falsified live**, upload six still blank |
| Issue #7, comment 2026-08-12 | Missing `<b:defaultmarkups>` leading to a fatal unknown-runtime-binding platform error | Real finding, but its live outcome was never confirmed in the issue thread before ADR 0001 moved on to a different hypothesis |
| `docs/BLANK_PAGE_FIX_POSTMORTEM.md` (new, 2026-08-16 to 2026-08-18 commits) | `maxwidgets` on `b:section` blocking widget instantiation on dashboard save, plus widget-id mismatches, plus a 3-level CSS Grid wrapper collapse, plus a global anchor-tag flex collision | **This is the fix that shipped.** Widgets now render per your own report. |

**Reconciliation:** these are not competing explanations of one bug, they are most likely
multiple simultaneous, compounding defects. `maxwidgets` blocking instantiation and a missing
`defaultmarkups` block are both plausible independent causes of a section rendering nothing,
and both may have been present at different points as the theme was rewritten repeatedly
between 2026-08-12 and 2026-08-16. The postmortem that shipped with the fix is the operative
record going forward, but it does not explicitly reconcile with or retract the defaultmarkups
finding from issue #7.

**Resolved 2026-08-18:** `src/theme.pug` was confirmed to ship `<b:defaultmarkups>` with a
`Common` entry (plus 13 other widget-type entries). The defaultmarkups issue and the
maxwidgets issue were both real, independent defects; both are now fixed and both are
contract-enforced going forward (`no-maxwidgets` and `defensive-defaultmarkups` rules in
`tools/contract-check.ts`).

### 1.2 'Production-ready and verified' is not yet true by this project's own standard

`docs/BLOG_REDESIGN_PROGRESS.md` states Status: Production-Ready and Verified, and lists six
offline checks (generate, contract:check, test:contract, test:golden, typecheck, test). It cites
no live-render evidence: no stamp-gated harness run, no Playwright pass across the ten view
types, no confirmation of Layout-mode rendering, no comment-rendering check.

This is precisely the overclaim pattern `docs/POSTMORTEM.md` finding F1 and `AGENTS.md` rule 1
exist to prevent: nothing is working because the XML looks right. Your own message, that the
theme can load properly with widgets, is real and valuable first-hand evidence, and is taken at
face value here. But it is owner spot-check evidence, not the project's own defined completion
bar (a stamp-gated render-harness or harness:browser run across all ten views, per
`docs/HARNESS.md`). Closing out M2 and updating the progress doc's status claim both require
that run. **This remains the single outstanding blocker** — see §4.

### 1.3 Recent work bypassed the project's own PR and CI gate

`docs/PROJECT-PLAN.md` §9 mandates branch protection requiring generate, render, and lighthouse
green plus review before merging to main. The commit history for 2026-08-16 through 2026-08-18
(the layout-alignment fix, the shell-alignment feature, the rich-widgets feature, the final
premium-redesign commit, and the interleaved build-stamp commits) is direct pushes to main, not
merges from reviewed PRs. `ci.yml`'s jobs presumably ran on push, but there is no render-path
live-verification job in `ci.yml` itself; `m2-staging.yml` is manually triggered only. Given the
size and risk of this redesign (new grid system, new JS features, seven widget files touched),
landing it without review or a live-render CI gate is a real process gap, independent of whether
the code turns out to be correct. Still worth enforcing going forward (§5), even though this
particular redesign has already landed.

### 1.4 Open editorial and content debt — resolved

**OD-5 (issue #2, label taxonomy): decided and closed 2026-08-18.** Shipping the 8 suggested
labels as-is, title case: `Penetration Testing`, `Red Teaming`, `Digital Forensics`, `OSINT`,
`Linux Hardening`, `Cloud Security`, `DevOps`, `AI Security`, applied to all 16 production posts.
**Applying the labels to actual post content is a manual Blogger-dashboard step** (Posts → select
post → Labels) — nothing in this repo's toolchain writes to post content, only theme XML. This
is called out explicitly in the issue #2 closing comment and in `PROJECT-PLAN.md` §11. The Topics
rail (`BLOG_DESIGN_SYSTEM.md` §4.3) will stay empty until this manual step happens, independent
of any theme code.

**M3c (card-grid vs lead-list layout, issue #11): decided and closed 2026-08-18.** Keeping the
shipped 2-column elevated-card grid. The AGY redesign brief explicitly requested a featured/latest
story card system, which is what shipped, so this is intentional direction rather than drift.
`PROJECT-PLAN.md` §2.4 is annotated with a superseding note pointing here.

---

## 2. Research folded into this plan

Full detail lives in the updated GOOGLE-BLOGGER-THEME-DEVELOPMENT skill (self-improved as part
of this task, see §6). Summary of what changes the plan:

**UI/UX craft.** Premium-feeling editorial sites (Vercel, Linear, and serious technical
publications) converge on: capped line length around 66 characters over full-width text, a
layered typography system (primary, secondary, mono, fallback, not just a font pairing), a
restrained OKLCH neutral palette with one true accent under 10 percent surface coverage, dark
mode as a deliberate palette shift rather than an inversion, editorial hierarchy (a
differently-sized lead item plus a plain list) over a uniform card grid, and explicit avoidance
of generic AI-website tropes (gradient-card walls, pill overload, glow behind every heading,
fabricated stats). The current `BLOG_DESIGN_SYSTEM.md` already gets most of this right (OKLCH
tokens, serif/sans/mono split, restrained accent). **See §1.4: the card-grid-vs-list question is
now resolved (M3c) — the shipped card grid is the intended direction, not drift.**

**Blogger gadget and widget compatibility.** Every dashboard-addable widget type needs a
defaultmarkup fallback or Blogger injects unstyled default HTML into an otherwise polished page.
Async-loading gadgets (Popular Posts, Blog Archive, Labels, ad slots) are a real CLS source, they
inject content after initial paint. Third-party gadgets often have real placement constraints
(for example needing to sit directly below the Blog Posts gadget). None of this blocks current
work, but it should inform which sections get gadget-ready treatment (see M4 below) and adds a
concrete test case worth exercising on staging: add one real dashboard gadget and confirm it
renders correctly with the current defaultmarkups. Tracked as issue #13.

---

## 3. Milestone table, revision 3

Supersedes `PROJECT-PLAN.md` §10. Completed items are locked; do not re-litigate their design
decisions without a new decision record.

| M | Name | Status | Exit criteria |
|---|---|---|---|
| M0 | Repo, staging, harness | Done | Unchanged from PROJECT-PLAN.md |
| M1 | Generation pipeline | Done | Unchanged |
| M2 | Render path | Code fix shipped, live verification outstanding — **only remaining blocker** | Stamp-gated render-harness or harness:browser run passes all ten views, HTTP plus no-JS plus reduced-motion. Close #7 only after this run, not before. |
| M3a | Design system, offline | Done, per BLOG_REDESIGN_PROGRESS.md Phases 1 to 4 and 7 | Tokens, type scale, layout, contract rules, already shipped and offline-verified |
| M3b | Design system, live-verified | Blocked on M2's harness run | Capture visual baselines at 375, 768, and 1440 for all ten views against real Blogger HTML. Confirm the state matrix in PROJECT-PLAN.md §2.6 (empty search, empty label, 404, no-image post, deleted-comment tombstone, etc.) actually renders as designed, not just as coded. |
| M3c | Design review against research | **Decided 2026-08-18** (issue #11) | Kept the shipped 2-column elevated-card grid; intentional direction, not drift. |
| M4 | Config zones plus gadget-readiness, expanded | Blocked on M2's harness run; OD-5 content decided | All seven zones live and editable. defaultmarkup for six widget types confirmed present. Real dashboard gadget test tracked in issue #13. Labels applied to production posts per OD-5 (issue #2) — taxonomy decided, manual Blogger-dashboard application still needed. |
| M5 | SEO plus a11y | Not started | Unchanged from PROJECT-PLAN.md, now actually reachable since rendering works |
| M6 | Performance | Not started | Unchanged. Note: current theme is 166 KB against a 500 KB budget with heavy new JS (audio reader, TOC scrollspy, search modal, drawer nav), worth a Lighthouse pass specifically because of the JS surface area added in the redesign |
| M7 | Cutover | Not started | Unchanged |
| M8/M9 | Reading experience, monetisation (issues #9, #10) | Deferred | No change, still after M7 |

**Sequencing note:** M3b (live design verification) and the outstanding M2 live-harness run are
effectively the same piece of work, one staging pass proves both.

---

## 4. Immediate next steps

One blocker remains before resuming forward M4 development:

1. **Run the stamp-gated render-harness (or harness:browser) against the current build,**
   against staging or production, with the exact SHA of the artifact actually uploaded to
   Blogger. This is the one piece of evidence that turns 'the theme can load properly with
   widgets' (owner observation) into a project-verifiable claim. Until this runs, M2 and M3b
   stay open and the progress doc's Verified claim is unsupported by the project's own standard.

Resolved items, kept for the record:

2. ~~Confirm `<b:defaultmarkups>` with a Common entry is present.~~ **Confirmed 2026-08-18** —
   present with 14 widget-type entries.
3. Reconciling `docs/decisions/0001-blogger-owns-widget-bindings.md` and `docs/M2-DEBT.md` with
   `docs/BLANK_PAGE_FIX_POSTMORTEM.md` as the actual resolution is still pending, but is a
   documentation cleanup, not a blocker — do it once step 1's harness run confirms the fix live.
4. ~~Decide on OD-5 (label taxonomy).~~ **Decided and closed 2026-08-18**, issue #2.
5. ~~Decide on M3c (card-grid vs lead-list).~~ **Decided and closed 2026-08-18**, issue #11.

---

## 5. CI changes — applied

All three code-level proposals from this section have been applied:

- **`no-maxwidgets` contract rule** added to `tools/contract-check.ts` (commit `5bffe76`),
  banning `maxwidgets` on any `b:section`, with matching test coverage in
  `tests/contract/adversarial-stress.test.ts` and `tests/contract/contract-check.test.ts`.
- **`defensive-defaultmarkups` coverage** was already enforced by an existing contract rule;
  confirmed still passing rather than duplicated.
- **`ci.yml`'s NFR-2 budget bumped from 25s to 45s** (commit `6fe42eab`) after the contract suite
  grew to 439 tests / 22 files and legitimately runs 30-40s; `PROJECT-PLAN.md` NFR-2's stale <5s
  target is annotated but not yet rewritten.

Not applied, and deliberately left as a recommendation rather than a change:

- **Auto-triggering `m2-staging.yml` on push to main.** On inspection this is the wrong fix:
  that workflow requires a `theme_sha` input tied to a *manual* Blogger upload (no upload API
  exists), so an automatic trigger would fail STALE on every run since nothing gets uploaded
  automatically. Left as `workflow_dispatch`-only, which is correct as-is.
- **Restoring PR-gated branch protection** (§1.3) is a GitHub repo-settings change, not
  something achievable via file edits from here — worth doing directly in repo settings.

---

## 6. Skill self-improvement (already applied)

The GOOGLE-BLOGGER-THEME-DEVELOPMENT skill has been updated with the hard-won lessons from this
journey, so future work (by any agent, not just this session) starts from the corrected
understanding rather than re-discovering it:

- `<b:defaultmarkups>` is load-bearing, not just defensive, its absence can cause a fatal
  platform parse error, not just a blank page.
- maxwidgets on a b:section blocks Blogger's own widget-instantiation parser on dashboard edits,
  now a documented banned construct.
- Blogger wraps widgets in multiple platform containers; CSS Grid must span every intermediate
  wrapper, not just the outermost one.
- Global utility selectors (for example anchor-tag touch-target rules) can collide with
  Blogger's own post markup in non-obvious ways.
- The round-trip export and diff diagnostic technique (upload, then re-export and diff against
  what you sent) for when reasoning about your own source code stops being useful.
- When the minimal case fails, stop: a failing minimal reproduction is a diagnosis instruction,
  not a data point to note and move past.
- Do not mark a decision record Accepted until it is live-verified.
- A distilled premium-editorial-UI/UX section and a gadget and widget compatibility section,
  based on external research, for future design and integration work.

---

## 7. Status

All editorial and CI-level items from this plan are resolved except one: the stamp-gated
harness run against the current build (§4, item 1). That run requires the owner to dispatch
`m2-staging.yml` with the exact SHA of the artifact currently uploaded to Blogger — no tool
available to this agent can trigger a GitHub Actions workflow_dispatch or write to the Blogger
API on the owner's behalf. Once that run passes, #7 and #11's M3b half can close, and M4's
remaining code work (gadget-readiness zones, per issue #13) can begin in earnest.
