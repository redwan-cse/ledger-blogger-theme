# Ledger

A Blogger **Layouts V3** theme for [blogs.redwan.work](https://blogs.redwan.work), built from source and continuously verified against real Blogger-rendered HTML.

> **Status: M4 config zones & defensive defaultmarkups implemented and offline-verified.** All seven layout zones (`header`, `navlinks`, `intro`, `topics`, `page_body`, `cta`, `footer`) and six defensive `b:defaultmarkup` templates (`Common`, `PopularPosts`, `FeaturedPost`, `ContactForm`, `BlogArchive`, `Label`) are implemented and verified. Top-level dispatch delegates to Blogger's native `super.main` with zero empty container artifacts on unpopulated sections.

## Rules

1. Rendered Blogger HTML is the evidence. XML shape alone never proves rendering.
2. No view may produce a blank content area.
3. The output budget is 500 KB. Line count is irrelevant.

## Start here

Read in this order: [`AGENTS.md`](AGENTS.md), [`docs/POSTMORTEM.md`](docs/POSTMORTEM.md), [`docs/V3-REFERENCE.md`](docs/V3-REFERENCE.md), [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md). Harness operation lives in [`docs/HARNESS.md`](docs/HARNESS.md).

## Setup and core checks

```sh
nvm use
npm ci
npm run typecheck
npm test
npm run test:contract
```

## Generation commands

```sh
npm run generate
npm run watch
npm run contract:check
npm run test:golden
```

Generation must finish in under 10 seconds, the fetch-denied contract suite in under 5 seconds, and `dist/theme.xml` must remain at or below 500 KB. CI runs on GitHub-hosted Linux runners and uploads the verified XML artifact.

### Deliberately updating the golden snapshot

1. Run `npm run generate` and `npm run contract:check`.
2. Replace only the full SHA in `dist/theme.xml` with `GOLDEN_SHA_40_CHARS________________`.
3. Review the complete XML diff, then update `tests/golden/theme.xml`.
4. Run `npm run test:golden` and `npm run test:contract`.

Never update the golden file merely to make CI green.

## Repository source layout

- `src/theme.pug`: generated XML shell.
- `src/defaultmarkups/`: defensive defaultmarkups for Common, PopularPosts, FeaturedPost, ContactForm, BlogArchive, Label.
- `src/widgets/`: modular widget templates (header, blog, linklist, label, intro, cta, footer, html).
- `src/styles/`: SCSS compiled into the single `b:skin` CDATA block. Split per `docs/PROJECT-PLAN.md` §3.3: `tokens.scss`, `base.scss`, `layout.scss`, `index.scss`, `article.scss`, `states.scss`, `main.scss` (entry).
- `src/scripts/`: TypeScript bundled into one inline IIFE.
- `tools/generate.ts`: deterministic compiler and size gate.
- `tools/contract-check.ts`: namespace-aware V3 contract validator.
- `tools/watch.ts`: serialized, coalescing source watcher.
- `tests/contract/`: isolated mutation and render-contract suite.
- `tests/golden/theme.xml`: canonical generated output snapshot.
- `tests/render/`: real Blogger Playwright checks, never hand-written DOM fixtures.

## Live Blogger commands

```sh
npm run seed:staging
npm run deploy:check
npm run harness
npm run harness:browser
```

All Blogger/API configuration uses environment variables documented in `.env.example`. Upload the exact green artifact before staging validation. A mismatched stamp is STALE, throttling/challenge is BLOCKED, and neither is a pass.

## Layout zones

| Zone | `id` | Widget | Purpose |
|---|---|---|---|
| Masthead | `header` | `Header` | Site title and tagline. Locked. |
| Nav | `navlinks` | `LinkList` | Menu items |
| Intro | `intro` | `HTML` | Editorial standfirst |
| Topics | `topics` | `Label` | Topic pills from real labels |
| Posts | `page_body` | `Blog` | The render path. Locked. |
| CTA | `cta` | `HTML` | Closing call to action |
| Footer | `footer` | `HTML` | Attribution and social links |

All seven layout zones and defensive defaultmarkups implemented in M4.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE): personal and other noncommercial use, modification, and contribution are allowed; commercial use is not. This is **not an OSI-approved open-source license**.

Identity-specific material belonging to Md Redwan Ahmed and Fast Cyber Defense is not licensed for reuse and must be replaced before public deployment or redistribution.
