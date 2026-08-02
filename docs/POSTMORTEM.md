# Postmortem: the predecessor theme

**Subject:** `DevRedwanAhmed/GoogleBloggerTheme`
**Outcome:** shipped a blank homepage for its entire life
**Why this document exists:** every requirement in the project plan traces back to
one of the five findings below.

---

## What happened

The theme was generated in a single pass by an AI agent that had never rendered a
Blogger page. It produced:

- 44 KB of valid, well-formed XML
- a competent SCSS design system (15 partials, design tokens, dark/light)
- a three-job CI pipeline
- 41 passing tests
- a README documenting features and widget zones

And it served **zero posts on the homepage, search, label, and archive views**
from the day it was installed.

Item pages rendered. Nothing else did.

---

## The five findings

### F1 — A V3 theme can fail totally and silently

`<b:widget id='Blog1' type='Blog'>` carried no `version='2'` while `<html>`
declared `b:layoutsVersion='3'`. Blogger treated the widget as legacy, discarded
every custom includable, and rendered its own defaults.

**The evidence.** The item page served 506 characters of post text while
containing neither `.post-single` nor `.post-body`. And exactly two JSON-LD
blocks appeared, both defined in `<head>`, while the third, `BlogPosting`,
defined inside the `post` includable, never did.

Head markup executed. Widget markup did not. Same file, same upload, different
fate. One missing attribute deleted the entire template body.

> **Rule:** version attributes are load-bearing. Contract check #1 asserts
> `version='2'` on every widget.

### F2 — Silence is the worst failure mode

```xml
<b:includable id='statusMessage'>
  <b:if cond='data:navMessage'>
    <div class='status-message'><data:navMessage/></div>
  </b:if>
</b:includable>
```

The only fallback when posts failed to resolve, and it emitted **nothing** unless
`data:navMessage` happened to be set. So the theme rendered a blank page instead
of an error and could not tell anyone why.

This is what turned a bug into an *undiagnosable* bug. It cost far more time than
F1 itself.

> **Rule:** empty states are infrastructure, not polish. No branch may emit
> nothing. Every empty and error state is a named, tested requirement.

### F3 — Never hide content behind an animation

```scss
.reveal {
  opacity: 0;
  transform: translateY(24px);
}
```

Every post card started invisible and only appeared when JavaScript added
`.visible` via IntersectionObserver. No no-JS fallback, no reduced-motion
handling, and the unsupported-API branch returned silently leaving everything
hidden forever.

Any blocked script, parse error, or motion preference produced the exact same
user-visible symptom as F1, with a completely different cause.

> **Rule:** content is visible by default. The successor removes scroll-triggered
> reveals entirely rather than fixing them.

### F4 — Testing a fixture is not testing

Playwright ran against `tests/mock.html`, a hand-written fixture that was neither
the built theme nor Blogger output.

That suite contained tests literally named:

- `[REGRESSION] post-grid is visible on homepage index`
- `[REGRESSION] post-card count is greater than 0 on homepage`
- `[REGRESSION] no post-card ancestors are at opacity:0 permanently`

**All three passed.** They passed because they pointed at a file where the cards
were hardcoded HTML. The regression tests for this exact bug already existed and
were aimed at a fake page.

Meanwhile `scripts/test.js` asserted that certain substrings existed in the
XML — a theme that is well-formed and renders nothing passes all ten checks.

> **Rule:** assert on output, never on shape. Fixture-based DOM tests are
> permanently banned.

### F5 — A test must know what it is measuring, or say it cannot tell

Two full debugging cycles were lost to misattribution.

**Cycle one: throttling read as failure.** The first harness run came back red
with `HTTP 429` and `solveSimpleChallenge is not defined` — Blogger's anti-bot
defense, not a theme defect. The harness had caused it: `retries: 2` plus
`workers: 2` across three projects turned ~14 intended page loads into roughly
100 requests in minutes. Retrying a throttled request is the one thing guaranteed
to make throttling worse.

**Cycle two: measuring a build that was never uploaded.** After fixing the widget
locally, the harness reported the *old* theme's defects against the *new* source,
because nothing had been deployed. Every failure in that run described a build
that no longer existed.

> **Rule:** four result states, not two. PASS, FAIL, BLOCKED (throttled or
> challenged), SKIP (precondition absent). BLOCKED is never PASS and never FAIL.
> And a build stamp gates the whole harness: it refuses to assert against a
> deployment that is not the working tree.

---

## The pattern underneath all five

Every failure was a **confident claim about something that was never verified**.

- The widget claimed to be V3-compatible. Never verified against a render.
- The empty state claimed to handle failure. Never verified against a failure.
- The animation claimed to be an enhancement. Never verified without JS.
- The test suite claimed coverage. Never verified against the real page.
- The harness claimed a diagnosis. Never verified what it was measuring.

The README described widget zones that did not exist, SCSS partials that were
never written, and configurability that was impossible. Not out of malice: the
generating agent wrote documentation for the theme it imagined, then tests that
confirmed the imagination.

> **The governing rule for the successor:** nothing is "working" because the XML
> looks right. Every requirement is verified against HTML that Blogger actually
> rendered.

---

## Defect carry-over

| Issue | Successor coverage |
|---|---|
| #1 Multi-item views render zero posts | R-V3-1 AC2 (direct root-cause guard) + R-RENDER-1 |
| #2 Silent empty state | R-EMPTY-1 |
| #3 `.reveal` opacity trap | R-EMPTY-2, plus scroll reveals removed entirely |
| #4 No pagination | R-RENDER-3 |
| #5 Static pages use post chrome | R-RENDER-4 |
| #6 Fabricated reading time and blank-Gravatar avatar | BR-3, R-BUILD-1 AC7 |
| #7 Unescaped JSON-LD | R-V3-2 AC5, R-SEO-1 |
| #8 Dead label links (7 links, 0 labels on 16 posts) | R-NAV-1 |
| #9 Phantom widget zones in the README | R-NAV-2 AC5 |
| #10 Image and font performance | R-PERF-1 |
| #11 Tests validate shape, not rendering | Testing strategy in full |
