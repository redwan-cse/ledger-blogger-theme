# Postmortem: The Predecessor Theme & Layouts V3 Runtime Hazards

**Subject:** `DevRedwanAhmed/GoogleBloggerTheme` & Blogger Layouts V3 Architecture  
**Outcome:** Resolved silent blank rendering, widget instantiation failures, and EL runtime crashes.  
**Why this document exists:** Every architecture decision and contract rule in this repository traces back to one of the findings below.

---

## Part 1: What Happened in the Predecessor Theme

The predecessor theme was generated in a single pass by an AI agent that had never rendered a real Blogger page. It produced:

- 44 KB of valid, well-formed XML
- A competent SCSS design system (15 partials, design tokens, dark/light)
- A three-job CI pipeline
- 41 passing tests asserting XML string presence
- A README documenting features and layout zones

And it served **zero posts on the homepage, search, label, and archive views** from the day it was installed. Item pages rendered minimal text; nothing else rendered at all.

---

## Part 2: The Core Postmortem Findings

### F1 — A V3 Theme Can Fail Totally and Silently
`<b:widget id='Blog1' type='Blog'>` carried no `version='2'` while `<html>` declared `b:layoutsVersion='3'`. Blogger treated the widget as legacy, discarded every custom includable, and rendered its own defaults.
- Head markup executed, but widget markup was discarded.
- One missing attribute deleted the entire template body.
> **Rule:** Version attributes are load-bearing. Contract check asserts `version='2'` on every `<b:widget>`.

### F2 — Silence is the Worst Failure Mode
The predecessor fallback emitted nothing unless `data:navMessage` happened to be populated:
```xml
<b:includable id='statusMessage'>
  <b:if cond='data:navMessage'>
    <div class='status-message'><data:navMessage/></div>
  </b:if>
</b:includable>
```
So the theme rendered a blank page instead of an informative error and could not tell anyone why.
> **Rule:** Empty states are infrastructure, not polish. No branch may emit nothing. Every empty and error state is a named, tested requirement.

### F3 — Never Hide Content Behind an Animation
Post cards started with `opacity: 0; transform: translateY(24px);` and depended on an `IntersectionObserver` JavaScript callback to reveal. Any blocked script, parse error, or user motion preference produced a permanently blank page.
> **Rule:** Content must be visible by default without JavaScript. Core rendering is 100% server-side.

### F4 — Testing a Fixture is Not Testing
The predecessor had Playwright tests pointing at `tests/mock.html` with hardcoded HTML post cards. The tests passed 100% while production was 100% blank.
> **Rule:** Assert on actual Blogger output or verified contract transformations, never on hand-written static fixtures.

### F5 — A Test Must Know What It Is Measuring
Debugging cycles were lost when an un-uploaded local build was tested against a stale live staging environment, reporting defects from an old build against new source code.
> **Rule:** A build stamp (`<meta name="theme-build" content="..."/>`) gates verification and refuses to assert against an un-deployed build.

### F6 — The `maxwidgets` Hazard and Database Migration Failure
Declaring `maxwidgets='1'` or `maxwidgets='3'` on `<b:section>` tags caused Blogger's internal layout database migration parser to fail to auto-populate default widget beans for custom section IDs.
- None of Google's official native V3 themes (Contempo, Soho, Notable, Essential, Emporio) use `maxwidgets`.
- Removing `maxwidgets` allows Blogger to bind widgets properly into its layout database.
> **Rule:** Never use `maxwidgets` on any `<b:section>`.

### F7 — Blogger Java EL Runtime Crash on `.empty`
Blogger's server-side template engine is backed by a custom Java Expression Language (EL) interpreter. Evaluating `.empty` on collections (such as `data:posts.empty`, `data:labels.empty`, or `data:comments.empty`) throws an unhandled Java reflection exception, abruptly terminating template execution and producing a blank page.
- Native V3 checks for non-empty collections truthily: `<b:if cond='data:posts'>`.
- Native V3 checks for empty collections with negation: `<b:if cond='not data:posts'>`.
> **Rule:** Never access `.empty`. Contract rule 37 (`no-dot-empty`) strictly forbids `.empty` anywhere in the template XML.

### F8 — Mandatory `super.main` Delegation in Blog1
Attempting to replace `Blog1`'s `main` includable with purely custom XML without invoking `<b:include name='super.main'/>` causes Blogger's Java engine to skip initializing pagination beans, post cursors, threaded comment iframes, and feed data beans.
> **Rule:** `Blog1`'s `main` includable must call `<b:include name='super.main'/>` and customize presentation through sub-includables (`post`, `postTitle`, `postBody`, `postFooter`, `comments`, etc.).

---

## Summary of Defect Carry-Over & Successor Protections

| Defect | Root Cause | Successor Defense |
|---|---|---|
| Blank multi-item views | Missing `version='2'`, lack of `super.main` | Contract Rule 3 (`widget-v2`), native `super.main` delegation |
| Silent empty state | Missing fallback branch | Rule 20, 24: defensive empty states across all 10 views |
| Opacity trap | `.reveal { opacity: 0; }` without JS fallback | CSS opacity trap permanently eliminated; 100% SSR visible |
| Fixture delusion | Tests ran against mock HTML | Tests run against generated `dist/theme.xml` & live Blogger HTML |
| Staging mismatch | Testing wrong deployment | Stamped deployment gate (`name='theme-build'`) |
| Uninstantiated widgets | `maxwidgets` on `<b:section>` | Removed `maxwidgets` from all 7 layout sections |
| EL runtime crash | `.empty` accessor on collections | Contract Rule 37 (`no-dot-empty`) enforced across whole theme |
| Unescaped JSON-LD | String interpolation in JSON-LD | Contract Rule 15 (`json-escaped`) on all schema values |
