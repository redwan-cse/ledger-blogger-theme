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
