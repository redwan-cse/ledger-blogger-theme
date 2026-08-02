# Ledger

A Blogger **Layouts V3** theme for [blogs.redwan.work](https://blogs.redwan.work), built from source and continuously verified against real rendered HTML.

> **Status: planning.** No theme source exists yet. That is deliberate. M0 builds the render harness *before* the thing it measures, because the predecessor theme was built for eight days before anyone discovered it rendered nothing.

---

## The three rules

**1. Nothing is "working" because the XML looks right.**
Every requirement is verified against HTML that Blogger actually rendered.

**2. Failure must be loud.**
No view may ever produce a blank content area. Every empty and error state is a named, tested requirement.

**3. Line count is not a goal.**
The predecessor was 44 KB of valid XML that rendered nothing. Budget is 200 KB, and less is better.

---

## Start here

| Document | What it is |
|---|---|
| [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md) | The build plan. Requirements, design system, CI, milestones. |
| [`docs/V3-REFERENCE.md`](docs/V3-REFERENCE.md) | Layouts V3 / Widget V2 platform reference. Read before writing any XML. |
| [`docs/POSTMORTEM.md`](docs/POSTMORTEM.md) | Why the previous theme failed. Five findings that drive every decision. |
| [`AGENTS.md`](AGENTS.md) | Working agreement for anyone (human or agent) contributing code. |

---

## The version trap, in one table

Three version numbers, and they are not the same thing. Confusing them is what broke the predecessor.

| Attribute | Value | Location | Meaning |
|---|---|---|---|
| `b:layoutsVersion` | `'3'` | `<html>` | The **theme format**. This is "V3". |
| `version` | `'2'` | every `<b:widget>` | The **widget markup version**. |
| `b:defaultwidgetversion` | `'2'` | `<html>` | Default for widgets Blogger injects itself. |

**A V3 theme uses version-2 widgets. There is no `version='3'` on a widget.**

`b:version='2' class='v2'` on `<html>` is the *V2 theme format* and must never appear. It is a common instruction in circulating tutorials and AI prompts, it contradicts `b:layoutsVersion='3'`, and pairing them silently discards every custom includable in the theme.

---

## Milestones

| M | Name | Days |
|---|---|---|
| M0 | Repo + staging blog + render harness | 1 |
| M1 | Generation pipeline (Pug → V3 XML) | 1.5 |
| M2 | Render path (the Blog widget) | 2 |
| M3 | Design system | 2 |
| M4 | Configurable zones | 1 |
| M5 | SEO + accessibility | 1 |
| M6 | Performance | 1 |
| M7 | Production cutover | 0.5 |

---

## Scope

**In:** one excellent theme for one working blog. Ten view types, all rendering with JavaScript disabled. WCAG 2.2 AA. Lighthouse mobile ≥ 90.

**Out:** resale or redistribution, Theme Designer colour customiser, AMP, Dynamic Views, third-party comments, dark mode (this release), IE, pre-2022 Safari.

## License

MIT
