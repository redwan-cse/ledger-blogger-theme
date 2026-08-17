# Working agreement

For anyone contributing code to this repository, human or agent.

This file exists because the predecessor theme was written by an agent that
documented the theme it imagined, then wrote tests that confirmed the
imagination. Read [`docs/POSTMORTEM.md`](docs/POSTMORTEM.md) before your first
commit.

---

## Read first, in this order

1. [`docs/POSTMORTEM.md`](docs/POSTMORTEM.md) — how the predecessor failed
2. [`docs/V3-REFERENCE.md`](docs/V3-REFERENCE.md) — the platform contract
3. [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md) — requirements and milestones

---

## The three rules

**1. Nothing is "working" because the XML looks right.**
The only evidence that counts is HTML Blogger actually rendered. Offline checks
prove the contract; they never prove rendering.

**2. Failure must be loud.**
No view may produce a blank content area. If you write a conditional branch that
can emit nothing, you have written the predecessor's worst bug again.

**3. Line count is not a goal.**
Budget is 500 KB (target 150 KB - 500 KB). The predecessor was 44 KB of valid XML that rendered nothing.

---

## Hard rules

### Never

- Write `<b:widget>` without `version='2'`
- Put `b:version` or `class='v2'` on `<html>` (that is the V2 theme format)
- Ship a theme with no `Header` widget declared
- Use `&&` or `||` in an expression — use `and` / `or`
- Use `data:blog.pageType` — use `data:view.*`
- Use `.size` or `gt`/`lt` — neither exists in V3
- Interpolate into JSON-LD without `.jsonEscaped`
- Hardcode a `/search/label/` URL
- Hide content behind an animation
- Make an image depend on a JS lazy-loader — use native `loading='lazy'`
- Add a test whose subject is a file we wrote by hand
- Add `|| true` or `continue-on-error` to a CI step
- Commit a fabricated value (reading time, author name, avatar)

### Always

- Branch on `data:view.*`, never on URL or page-type strings
- Give every conditional a branch that renders something
- Compose URLs with the `path` operator
- Declare unwanted includables **empty** rather than omitting them
- Use `b:with` to compute a value once when it is used more than once
- Cap a loop with `index` server-side rather than trimming in JavaScript
- Give every new lint rule a self-test that proves it catches a real violation
  **and** does not flag a comment describing one
- Verify on staging before production, always

---

## Definition of done for a change

A change is not done until:

1. `npm run generate` succeeds
2. `npm run test:contract` passes
3. `npm run test:golden` passes, or the snapshot update is deliberate and reviewed
4. If it touches `src/widgets/blog.pug`: a staging render pass (BR-7)
5. The requirement ID it satisfies is named in the PR description

---

## When you are stuck on Blogger behaviour

In order:

1. Check [`docs/V3-REFERENCE.md`](docs/V3-REFERENCE.md)
2. Read Google's own native V3 theme XML in `docs/reference/` — the highest
   fidelity source available, because Google ships it
3. Check the other sources at the bottom of the reference
4. **Test it on staging.** Not production, not a guess, not a tutorial.

Most material online is V1/V2-era, including recent posts and AI prompts that
claim to be modern. **Treat borrowed guidance as a hypothesis until verified on
staging** (BR-8). `docs/PROJECT-PLAN.md` §11 has a worked example of a checklist
that was two-thirds right and one-third catastrophic.

---

## Commit and PR conventions

Conventional commits: `feat`, `fix`, `docs`, `test`, `ci`, `chore`.
Scope with the milestone where it helps: `fix(m2): …`.

A PR description states:

- the requirement ID(s) it satisfies
- how it was verified (contract / staging render / manual)
- anything it deliberately does **not** cover

If a harness run was inconclusive (BLOCKED or STALE), say so. **Do not report an
inconclusive run as a pass.** That mistake cost two debugging cycles on the
predecessor.
