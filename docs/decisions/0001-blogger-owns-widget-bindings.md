# ADR 0001: Blogger owns widget bindings; the theme must match them

- **Date:** 2026-08-13
- **Status:** Accepted, pending live confirmation
- **Supersedes:** the working notes in `docs/M2-BLANK-RENDER-INVESTIGATION.md`
- **Requirements:** R-RENDER-1, R-RENDER-2, R-EMPTY-1, BR-1, BR-7

## Context

M2 shipped a Blog widget that rendered nothing on every view for nine days. The Header widget
rendered its title and tagline correctly on the same page, so the document shell, `b:skin`,
namespaces, and widget versioning were all provably working. Only `Blog1` produced no output.

Every offline gate stayed green through **five** separate blank uploads: deterministic
generation, 19 namespace-aware contract rules, the golden snapshot, and the render-contract
suite. The build stamp was verified against the deployed theme, so none of the failures were
stale artifacts.

We eliminated causes in this order, each with evidence:

1. **Missing `version='2'`**, the predecessor's F1 root cause. Present on both widgets throughout.
2. **Our custom includables.** A bisect build whose Blog widget contained only
   `<b:includable id='main'><b:include name='super.main'/></b:includable>` still rendered blank.
3. **Pug mangling.** Real bug, found and fixed: `data:post.title/` compiled to
   `<data:post class="title"/>` because Pug read the dots as CSS class syntax. Fixing it did not
   restore rendering, so it was a defect but not the cause.
4. **A missing `all-head-content` include** and missing `expr:dir`/`expr:lang`. Real gaps against
   Google's shipped Contempo export. Fixing them did not restore rendering either.

The answer arrived from the Blogger dashboard, not the codebase. **Layout mode showed the
`Header` and `Page Body` sections completely empty**, while a Contempo screenshot of the same
blog showed every section populated with gadgets.

## Decision

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

## Consequences

- Underscores are now allowed in section ids. Our contract required letter-first alphanumeric,
  which would have rejected `page_body` outright even though Google's own theme ships it.
- Offline gates cannot detect this class of failure at all. Nothing in generated XML reveals a
  binding mismatch; only Layout mode or a live render does.
- Layout-mode inspection is now the **first** diagnostic step for any blank widget, before code.
- If bindings are ever lost, recovery is a layout repair in the Blogger dashboard, not a
  template change.

## Alternatives considered

- **Keep iterating on widget markup.** Rejected after the zero-includable bisect proved the
  markup was irrelevant.
- **Adopt Contempo's shell wholesale.** Rejected as it would discard the M2 render contract, and
  it would have masked the real cause rather than explaining it.
- **Drop `version='2'` to match Contempo's Blog widget.** Rejected permanently. Contempo relies on
  `b:defaultwidgetversion='2'`; removing the explicit attribute reproduces failure F1 exactly.

## Lessons, added to the standing rules

1. A green contract suite proves the XML is valid. It proves nothing about whether Blogger will
   execute it. This is finding F1 in a new costume, and it cost nine days.
2. When one widget renders and another does not, the difference is **configuration**, not markup.
   Check the platform's own state first.
3. Cheap diagnostics before expensive ones. One Layout-mode screenshot outranked five upload
   cycles, four hypotheses, and roughly thirty commits.
4. Never rename a bound id to satisfy a lint rule. Fix the rule.

## Follow-up

1. Upload the artifact built from the restored bindings.
2. Run stamp-gated staging validation across all ten views in HTTP, no-JavaScript, and
   reduced-motion contexts.
3. Only then may M2 be claimed complete.
