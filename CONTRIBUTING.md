# Contributing

## Setup

Node 24 (`.nvmrc`), then:

```bash
npm ci
cp .env.example .env.local   # add a Gemini key to try the AI features
npm run dev
```

Everything except the AI works without a key. Playwright needs its browser
once: `npx playwright install --only-shell chromium webkit`, as CI does.

## Before you open a pull request

`npm run verify` runs every gate CI runs: lint, types, format, unit and
component tests with the 100% coverage gate, `npm audit`, the production build
and the Playwright tests. A change is ready when it passes.

## How the code is kept

- Domain logic is pure functions in `lib/plan`, one concern per file. A plan
  edit is a function from one record to the next.
- Server modules import `server-only`. Route handlers take their dependencies
  as arguments so tests can pass a mock model and a fixed clock.
- Functions stay under 80 lines and a complexity of 10, and files under 200
  lines; lint enforces all three.
- One exported component per file, with only small private parts beside it; a
  context's provider keeps its hooks with it, and other hooks get a file each.
  Planner parts sit in one folder per tab, and code and tests import anything
  outside their own folder through `@/`.
- Every string the user sees is in `lib/i18n/en.json` and `lib/i18n/hi.json`,
  and a test fails if the two files have different keys. The exceptions are
  deliberate: the policy pages (`lib/i18n/legal.ts`), the fixed reply to a
  screened chat message (`lib/ai/guard.ts`), the Maps search phrases, which
  stay in English because that finds the most listings
  (`lib/plan/vendor-search.ts`), and the crash page, which renders without the
  language providers (`app/global-error.tsx`).
- No inline `style` attributes, since the CSP has no `unsafe-inline`, and no
  `dangerouslySetInnerHTML`, which lint forbids.
- Anything sent to the model goes through `factsOf` and `fence`, so the event
  title, guests and vendor notes stay in the browser and typed text is
  screened and redacted first.
- New dependencies are pinned to an exact version and need a reason in the
  pull request.

## Tests

- Unit and component tests live in `tests/`, in folders named after the source.
  Component tests run axe with the WCAG 2.2 AA, best-practice and experimental
  rules.
- Browser tests live in `e2e/` and run on a desktop and a 360 px phone in
  Chromium. The flows tagged `@webkit` also run on an iPhone in WebKit, the
  engine of every iPhone browser.
- `npm run eval` checks the prompts against the real model and needs a key.
  More in [TESTING.md](TESTING.md).

## Commits

One change per commit, with a short subject such as `fix: keep focus on More
after Reset`. The prefixes in use are `feat`, `fix`, `refactor`, `test`,
`docs`, `ci` and `build`.

## Security problems

Please report them privately, as described in [SECURITY.md](SECURITY.md), not
in an issue.
