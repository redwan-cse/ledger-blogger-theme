# Ledger

A Blogger **Layouts V3** theme for [blogs.redwan.work](https://blogs.redwan.work), built from source and continuously verified against real Blogger-rendered HTML.

> **Status: M0 in progress.** The Node 24.18.1 scaffold, deterministic install, Blogger API staging seed, serialized render transport, result model, build-stamp gate, and ten-view harness plan exist. No theme source exists yet. Staging creation, seeding, native-theme export, and the required RED run remain.

## Rules

1. Rendered Blogger HTML is the evidence. XML shape alone never proves rendering.
2. No view may produce a blank content area.
3. The output budget is 200 KB. Line count is irrelevant.

## Start here

Read in this order: [`AGENTS.md`](AGENTS.md), [`docs/POSTMORTEM.md`](docs/POSTMORTEM.md), [`docs/V3-REFERENCE.md`](docs/V3-REFERENCE.md), [`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md). Harness operation lives in [`docs/HARNESS.md`](docs/HARNESS.md).

## Local checks

```sh
nvm use
npm ci
npm run typecheck
npm test
```

## M0 commands

```sh
npm run seed:staging
npm run deploy:check
npm run harness
npm run harness:browser
```

All staging/API configuration uses environment variables documented in `.env.example`. Never commit credentials.

## Layout zones

| Zone | `id` | Widget | Max | Purpose |
|---|---|---|---|---|
| Masthead | `masthead` | `Header` | 1 | Site title and tagline. Locked. |
| Nav | `navlinks` | `LinkList` | 1 | Menu items |
| Intro | `intro` | `HTML` | 1 | Editorial standfirst |
| Topics | `topics` | `Label` | 1 | Topic pills from real labels |
| Posts | `main` | `Blog` | 1 | The render path. Locked. |
| CTA | `cta` | `HTML` | 1 | Closing call to action |
| Footer | `footer` | `HTML` | 3 | Attribution and social links |

## License

MIT
