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
finding from issue #7. **Action needed (see §4):** confirm the current `src/theme.pug` still
ships `<b:defaultmarkups>` with a `Common` entry. If the `maxwidgets` fix alone resolved
rendering without restoring defaultmarkups, that is a second latent bug waiting for the day a
widget touches native default markup the current build hasn't needed yet.

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
that run. This is the first item in §4.

### 1.3 Recent work bypassed the project's own PR and CI gate

`docs/PROJECT-PLAN.md` §9 mandates branch protection requiring generate, render, and lighthouse
green plus review before merging to main. The commit history for 2026-08-16 through 2026-08-18
(the layout-alignment fix, the shell-alignment feature, the rich-widgets feature, the final
premium-redesign commit, and the interleaved build-stamp commits) is direct pushes to main, not
merges from reviewed PRs. `ci.yml`'s jobs presumably ran on push, but there is no render-path
live-verification job in `ci.yml` itself; `m2-staging.yml` is manually triggered only. Given the
size and risk of this redesign (new grid system, new JS features, seven widget files touched),
landing it without review or a live-render CI gate is a real process gap, independent of whether
the code turns out to be correct. See §5 for the CI proposal.

### 1.4 Open editorial and content debt is unaffected and still blocks M4

Issue #2 (OD-5, label taxonomy) is unresolved: production posts still carry no labels as far as
this repo's records show. `BLOG_DESIGN_SYSTEM.md` §4.3 references a Topics rail sourced from
real labels, which cannot show anything until #2 is resolved. This is an editorial decision for
you, not something to automate.

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
tokens, serif/sans/mono split, restrained accent). The main open question is whether the
implemented 2-column card grid (with drop shadows and hover lifts on every card) drifts toward
the uniform-grid anti-pattern the original `PROJECT-PLAN.md` §2.4 explicitly rejected in favor
of a lead-post-plus-hairline-list layout. Worth a design review, not a rewrite (see §4).

**Blogger gadget and widget compatibility.** Every dashboard-addable widget type needs a
defaultmarkup fallback or Blogger injects unstyled default HTML into an otherwise polished page.
Async-loading gadgets (Popular Posts, Blog Archive, Labels, ad slots) are a real CLS source, they
inject content after initial paint. Third-party gadgets often have real placement constraints
(for example needing to sit directly below the Blog Posts gadget). None of this blocks current
work, but it should inform which sections get gadget-ready treatment (see M4 below) and adds a
concrete test case worth exercising on staging: add one real dashboard gadget and confirm it
renders correctly with the current defaultmarkups.

---

## 3. Milestone table, revision 3

Supersedes `PROJECT-PLAN.md` §10. Completed items are locked; do not re-litigate their design
decisions without a new decision record.

| M | Name | Status | Exit criteria |
|---|---|---|---|
| M0 | Repo, staging, harness | Done | Unchanged from PROJECT-PLAN.md |
| M1 | Generation pipeline | Done | Unchanged |
| M2 | Render path | Code fix shipped, live verification outstanding | Stamp-gated render-harness or harness:browser run passes all ten views, HTTP plus no-JS plus reduced-motion. Confirm b:defaultmarkups (Common at minimum) is present in current src/theme.pug. Close #7 only after this run, not before. |
| M3a | Design system, offline | Done, per BLOG_REDESIGN_PROGRESS.md Phases 1 to 4 and 7 | Tokens, type scale, layout, contract rules, already shipped and offline-verified |
| M3b | Design system, live-verified | Newly unblocked, not started | Now that widgets render, capture visual baselines at 375, 768, and 1440 for all ten views against real Blogger HTML. Confirm the state matrix in PROJECT-PLAN.md §2.6 (empty search, empty label, 404, no-image post, deleted-comment tombstone, etc.) actually renders as designed, not just as coded. |
| M3c | Design review against research, new | Not started | One focused pass: does the shipped 2-column elevated-card grid drift toward the uniform-card-grid anti-pattern the original plan rejected. Confirm lead and list hierarchy reads as edited, not assembled, on a real render. Not a rewrite, a checklist review against §2 of this doc. |
| M4 | Config zones plus gadget-readiness, expanded | Not started | All seven zones live and editable. defaultmarkup for six widget types confirmed present. New: add one real dashboard gadget on staging and confirm it renders without breaking layout (validates the gadget-compatibility research in §2). Labels applied to production posts, blocked on OD-5, issue #2, your call. |
| M5 | SEO plus a11y | Not started | Unchanged from PROJECT-PLAN.md, now actually reachable since rendering works |
| M6 | Performance | Not started | Unchanged. Note: current theme is 166 KB against a 500 KB budget with heavy new JS (audio reader, TOC scrollspy, search modal, drawer nav), worth a Lighthouse pass specifically because of the JS surface area added in the redesign |
| M7 | Cutover | Not started | Unchanged |
| M8/M9 | Reading experience, monetisation (issues #9, #10) | Deferred | No change, still after M7 |

**Sequencing note:** M3b (live design verification) and the outstanding M2 live-harness run are
effectively the same piece of work, one staging pass proves both. Recommend doing them together
rather than as two separate efforts.

---

## 4. Immediate next steps, in order, before writing more code

These are the self-improvement-from-the-journey items translated into action, ordered by
dependency:

1. **Run the stamp-gated render-harness (or harness:browser) against the current build,**
   against staging or production. This is the one piece of evidence that turns 'the theme can
   load properly with widgets' (your observation) into a project-verifiable claim. Until this
   runs, M2 stays open and the progress doc's Verified claim is unsupported by the project's own
   standard.
2. **Confirm `<b:defaultmarkups>` with a Common entry is present in the current
   `src/theme.pug`.** The maxwidgets fix explains the reported symptom; it does not confirm or
   rule out the separately-diagnosed defaultmarkups issue from issue #7. Five minutes to check,
   and it closes a loose thread that could resurface the moment a widget touches native default
   markup the current build hasn't exercised yet.
3. **Reconcile `docs/decisions/0001-blogger-owns-widget-bindings.md` and `docs/M2-DEBT.md`**
   with the actual fix. Both currently describe an unsolved mystery; both should be updated to
   point at `docs/BLANK_PAGE_FIX_POSTMORTEM.md` as the resolution, once step 1 confirms it live.
4. **Decide on OD-5 (issue #2, label taxonomy).** This is a content decision only you can make,
   and it blocks M4. The suggested set in the issue (Penetration Testing, Red Teaming, Digital
   Forensics, OSINT, Linux Hardening, Cloud Security, DevOps, AI Security) is still reasonable.
5. **Decide on the M3c design review** (§3 above): is the current elevated-card grid the intended
   direction, or should it move closer to the original plan's lead-plus-hairline-list layout?
   This is a judgment call for you. The researched craft argument favors the lead-plus-list
   pattern, but the AGY brief you supplied explicitly asked for a featured and latest story
   system with cards, which is closer to what shipped. Worth a conscious choice rather than an
   accidental drift.
6. **Only after 1 to 4 are resolved, resume forward development on M4.**

---

## 5. Proposed CI changes (for your review before applying)

- **Add to `ci.yml`'s existing Blogger-layout-binding audit script:** a check that
  `src/theme.pug` and every file under `src/defaultmarkups/` collectively declare a
  `b:defaultmarkups` block containing a Common entry, turning the issue #7 finding into a
  permanent regression guard, the same way maxwidgets should be banned by the contract suite.
- **Add a maxwidgets ban to `tools/contract-check.ts`:** fail the build if any b:section carries
  a maxwidgets attribute, per `docs/BLANK_PAGE_FIX_POSTMORTEM.md` rule 1. This currently has no
  automated enforcement, nothing stops it from being reintroduced.
- **Wire `m2-staging.yml` (or a new job) to run automatically on push to main** rather than
  purely workflow_dispatch, now that the render path plausibly works and is worth continuously
  verifying rather than checking manually and infrequently.
- **Restore the branch-protection expectation from `PROJECT-PLAN.md` §9** going forward: land
  render-path-affecting changes through a PR with the render job green, rather than direct
  pushes to main. This is a process recommendation, not a code change, GitHub branch protection
  rules aren't something verifiable or settable from here, worth checking in the repo settings.

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

## 7. What I'm explicitly not doing yet

Per your instruction, no new theme code is being written as part of this task. GitHub issue
updates (closing #7, commenting on #11, opening new tracking issues for the items in §4) and
the CI changes in §5 are proposed here for your confirmation before applying them, since they
touch multiple issues and a CI pipeline used for gating real deployments.
