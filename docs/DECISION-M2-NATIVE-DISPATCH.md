# M2 decision: delegate Blog top-level dispatch to `super.main`

- **Date:** 2026-08-05
- **Status:** Accepted, pending staging verification
- **Requirements:** R-RENDER-1, R-RENDER-2, R-EMPTY-1

## Context

Two stamped M2 artifacts were uploaded to the backed-up development blog. Both passed every
offline gate (generation, 19 contract rules, golden snapshot, render-contract suite) and both
rendered a blank content area. The Header widget rendered its title and tagline correctly, so
the document shell, `b:skin`, and widget versioning were all working. Only the `Blog` widget
produced nothing across home, label, search, archive, post, static page, empty result, and 404.

The common factor across both failures was a fully hand-written `main` includable inside the
`Blog` widget that performed its own view dispatch and its own `data:posts` loop.

## Decision

The `Blog` widget's `main` includable now contains only:

```xml
<b:includable id='main'>
  <b:include name='super.main'/>
</b:includable>
```

Blogger's native V3 renderer performs top-level dispatch and post iteration, then calls our
overridden `post`, `postHeader`, `postTitle`, `postMeta`, `postBody`, `postBodySnippet`,
`postFooter`, `postPagination`, `status-message`, and comment includables.

## Alternatives considered

- **Keep the custom dispatcher and keep debugging it.** Rejected: two uploads produced zero
  rendered content and offline checks cannot reproduce the failure, so each iteration costs a
  full manual upload cycle against a live blog.
- **Fall back to Blogger defaults entirely.** Rejected: it would discard the M2 render contract.

## Rationale

The committed native Contempo 1.3.3 export at `docs/contempo-1.3.3.xml` uses exactly this
pattern: its `Blog` default markup overrides `main` and immediately calls `super.main`, keeping
Google's dispatch while customizing the child includables. Following the shipped Google theme is
the highest-fidelity evidence available, per `docs/V3-REFERENCE.md` §9.

## Consequences

- Custom presentation is preserved through child includables.
- Native pagination, empty-state, and comment wiring are restored.
- Duplicate comment rendering is possible if native `main` already invokes `postCommentsAndAd`;
  staging must confirm exactly one comment section per post page.
- No completion claim is valid until a stamp-gated staging run passes all ten views.

## Follow-up

1. Upload the artifact built from this branch head.
2. Run **M2 staging validation** with a matching `EXPECTED_THEME_BUILD`.
3. Record HTTP, JS-disabled, and reduced-motion evidence, plus Layout mode.

## 2026-08-12 regression and re-affirmation

Commit `dadc3c0` ("Refactor blog rendering and empty states") reverted the `main`
includable to a hand-written top-level dispatcher and loop over `data:posts` —
exactly the pattern this decision rejected — in order to add a homepage
lead/row split. It also rewrote the guarding test in
`tests/contract/m2-render-contract.test.ts` to require that pattern and assert,
without new staging evidence, that `super.main` "causes runtime errors."

**Live evidence.** Fetching `https://blogs.redwan.work/` with that build
deployed (`theme-build` meta matched `dadc3c0`'s SHA) showed both the `Header`
and `Blog` sections rendered as empty `<div class='… no-items section' …>`
shells with no widget markup inside at all — worse than the original symptom,
where Header always rendered correctly. This matches the postmortem's F1/F4
pattern precisely: the change passed every offline gate and still produced a
blank page in production.

**Action taken.** Reverted `main` back to `<b:include name='super.main'/>`,
restored the original test assertion, and removed the now-unreachable
`postLead`/`postRow` includables (they were only ever invoked from the
hand-rolled loop this decision already rejects). The empty-state richness and
comment-tombstone handling added in the same commit were kept — both are
legitimate overrides of native includables (`status-message`,
`threadedComments`) that native dispatch calls on its own, so they do not
require a custom top-level loop.

**Not done.** The homepage lead/row visual split has no native hook — the
documented Blog includable contract exposes no per-item position or "is first
post" signal to an item rendered through `super.main`. A hypothesis worth
testing later: compare `data:post.id == data:posts.first.id` from inside the
overridden `post` includable, gated on `data:view.isHomepage and not
data:newerPageUrl`, without reintroducing a custom loop. This is unverified
and must not ship to production without a staging render proving it, per
BR-8.

**Standing instruction.** Do not reintroduce a hand-written `main` dispatcher
for the `Blog` widget. If a future requirement seems to need one, treat that
as a signal to find a native-compatible mechanism (child includable override,
or a separate widget as Contempo does with `FeaturedPost`) instead, and get a
staging render before merging.
