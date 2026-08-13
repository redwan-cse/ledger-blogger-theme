# ADR 0001: Blogger owns widget bindings; the theme must match them

- **Date:** 2026-08-13
- **Status:** **FALSIFIED 2026-08-13.** The decision below was tested live and did not fix the blank render. See [Falsification](#falsification-2026-08-13). The id-hygiene rules it introduced are retained; the causal claim is withdrawn.
- **Amended:** 2026-08-13, elimination order corrected. See [Corrected chronology](#corrected-chronology-amended-2026-08-13).
- **Supersedes:** the working notes in `docs/M2-BLANK-RENDER-INVESTIGATION.md`
- **Requirements:** R-RENDER-1, R-RENDER-2, R-EMPTY-1, BR-1, BR-7

## Context

M2 shipped a Blog widget that rendered nothing on every view for nine days. The Header widget
rendered its title and tagline correctly on the same page, so the document shell, `b:skin`,
namespaces, and widget versioning were all provably working. Only `Blog1` produced no output.

Every offline gate stayed green through **six** blank uploads: deterministic generation, 19
namespace-aware contract rules, the golden snapshot, and the render-contract suite. The build
stamp was verified against the deployed theme, so none of the failures were stale artifacts.

## Corrected chronology, amended 2026-08-13

An earlier revision of this ADR listed the minimal-widget bisect as the **second** cause
eliminated, as though it were a narrowing step taken partway through the investigation. That is
wrong. **The bisect was upload one**, before any custom widget code existed.

| # | Upload | Result |
|---|---|---|
| 1 | **Minimal widget.** `<b:includable id='main'><b:include name='super.main'/></b:includable>` and nothing else. | Blank |
| 2 | Full render path: complete includable inventory, view dispatch, pager, empty and error states, comments. | Blank |
| 3 | `version='2'` audit. Present on both widgets throughout; nothing to fix. | Blank |
| 4 | Pug data-tag mangling fixed (`data:post.title/` was compiling to `<data:post class="title"/>`). | Blank |
| 5 | Shell parity with Contempo: added `all-head-content`, `expr:dir`, `expr:lang`. | Blank |
| 6 | Bound ids restored per the decision below. | Blank |

The correction matters for three reasons:

1. **The render path was never once observed working.** There is no known-good state to bisect back to.
2. **Widget contents were ruled out before any widget content existed.** Upload 1 had no custom includables, no data tags, and no view dispatch, and it still rendered nothing. Hypotheses 3, 4 and 5 were therefore already answered by upload 1 and were investigated anyway.
3. **Four days of widget development postdate a decisive negative result.** Uploads 2 through 6 added code on top of a render path that had already been observed producing no output at its smallest possible size.

## Causes eliminated, with evidence

1. **Our custom includables.** Eliminated by upload 1, which had none and rendered blank anyway.
2. **Missing `version='2'`**, the predecessor's F1 root cause. Present on both widgets throughout.
3. **Pug mangling.** Real bug, found and fixed: `data:post.title/` compiled to
   `<data:post class="title"/>` because Pug read the dots as CSS class syntax. Could not have been
   the cause, since upload 1 contained no data tags at all.
4. **A missing `all-head-content` include** and missing `expr:dir`/`expr:lang`. Real gaps against
   Google's shipped Contempo export. Fixing them did not restore rendering either.

The answer appeared to arrive from the Blogger dashboard, not the codebase. **Layout mode showed
the `Header` and `Page Body` sections completely empty**, while a Contempo screenshot of the same
blog showed every section populated with gadgets.

## Decision (withdrawn, see Falsification)

Blogger stores widget-to-section bindings in its own layout database, keyed by widget id and
section id. The uploaded XML does not create those bindings; it must **match** them. A widget
whose id or section id does not match an existing binding is never instantiated, so it renders
nothing while the rest of the page renders normally.

The theme therefore uses the ids Blogger already has bound:

| Element | Bound id |
|---|---|
| Header section | `header` |
| Header widget | `Header1` |
| Posts section | `page_body` |
| Blog widget | `Blog1` |

These ids are frozen. CI fails if any of them change, and the render-contract suite asserts the
exact ordered list of section and widget ids.

## Contributing factor: id churn

Across the investigation the Posts section id changed five times:
`content` -> `mainContent` -> `main` -> `pageBody` -> `page_body`. Two of those renames were mine,
one came from a local agent that also renamed the widgets to `Header2` and `Blog2`. Every rename
guaranteed a fresh binding miss. **Renaming a section or widget id is a breaking change to a live
blog**, not a cosmetic edit.

## Falsification, 2026-08-13

The artifact built from commit `8dde01f6e4a4dacef11089798da292e70d68a9c8`, containing exactly the
bindings frozen above, was uploaded to production. **The page is still blank.**
`https://blogs.redwan.work/` serves the Header widget's `h1` and tagline and zero posts, which is
byte-for-byte the same symptom as uploads one through five.

This is upload six. The binding hypothesis predicted a fix and delivered none, so it is withdrawn
as the cause.

**What survives.** The id-hygiene rules stand on their own merits and are kept:

- Matching Blogger's existing bound ids is correct regardless, because a mismatch is a real
  failure mode even if it was not *this* failure.
- Underscores remain legal in section ids. Google's own Contempo ships `page_body`; a lint rule
  that rejects Google's own output is a broken lint rule.
- Renaming a bound id on a live blog remains a breaking change.
- Layout-mode inspection remains a cheap first diagnostic.

**What is withdrawn.** The claim that a binding mismatch caused the M2 blank render. Four
hypotheses are now eliminated with live evidence, and the cause is still unknown.

**The untested hypothesis that should be tested next, before any further code change:**
**Blogger is dropping the `Blog1` widget at upload time.** We have never once looked at what
Blogger *stored*, only at what we sent. Blogger rewrites a theme when it saves it. Export the
theme back out of the dashboard immediately after an upload and diff that export against the
`theme.xml` we uploaded. Three outcomes, all decisive:

1. `Blog1` is **absent** from the export. Blogger rejected the widget during parsing. The diff
   shows exactly what it objected to, and the question becomes what in our widget it refuses.
2. `Blog1` is **present but rewritten**. The rewrite is the answer, and it is visible in the diff.
3. `Blog1` is **present and identical**. The theme is stored correctly and the fault is in the
   render layer or in dashboard configuration (posts-per-page, widget visibility, a display
   setting), not in the XML at all.

This costs one upload and one export. Every hypothesis so far has cost a full build-and-verify
cycle and has been argued from the XML we *sent*, which is the one artifact already proven not to
match reality.

## Consequences

- Underscores are now allowed in section ids.
- Offline gates cannot detect this class of failure at all. Nothing in generated XML reveals a
  binding mismatch; only Layout mode or a live render does.
- Layout-mode inspection is now an early diagnostic step for any blank widget, before code.
- If bindings are ever lost, recovery is a layout repair in the Blogger dashboard, not a
  template change.

## Alternatives considered

- **Keep iterating on widget markup.** Rejected. Upload 1 proved the markup was irrelevant before
  any markup was written, and nothing since has challenged that result.
- **Adopt Contempo's shell wholesale.** Rejected as it would discard the M2 render contract, and
  it would have masked the real cause rather than explaining it. **Now worth reconsidering** if
  the export diff is inconclusive: a known-rendering shell that we strip back toward our contract
  converts an open-ended search into a bisect with a guaranteed-good starting point. Note that
  this is currently the *only* route to a known-good baseline, because our own theme has never
  rendered posts even once.
- **Drop `version='2'` to match Contempo's Blog widget.** Rejected permanently. Contempo relies on
  `b:defaultwidgetversion='2'`; removing the explicit attribute reproduces failure F1 exactly.

## Lessons, added to the standing rules

1. **When the minimal case fails, stop.** Upload 1 was a correct experiment with a decisive
   result, and development continued straight past it for four days. A failing minimal case is a
   diagnosis instruction, not a data point to note and move on from.
2. A green contract suite proves the XML is valid. It proves nothing about whether Blogger will
   execute it. This is finding F1 in a new costume, and it cost nine days.
3. When one widget renders and another does not, the difference is **configuration**, not markup.
   Check the platform's own state first.
4. Cheap diagnostics before expensive ones.
5. Never rename a bound id to satisfy a lint rule. Fix the rule.
6. **Inspect what the platform stored, not only what you sent.** Six uploads were reasoned about
   from our own output. The round-trip export was available the entire time and was never taken.
7. A decision record written before live confirmation is a hypothesis with formatting. This one
   was marked "Accepted, pending live confirmation" and was wrong within the hour. Do not mark an
   ADR accepted until the evidence is in hand.
8. **Record the order of experiments as they happen.** This ADR misplaced its own most important
   result, which made a dead end look like progress.
