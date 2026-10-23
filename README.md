# Shamiyana

[![CI](https://github.com/Bisman-Singh/shamiyana/actions/workflows/ci.yml/badge.svg)](https://github.com/Bisman-Singh/shamiyana/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Bisman-Singh/shamiyana/actions/workflows/codeql.yml/badge.svg)](https://github.com/Bisman-Singh/shamiyana/actions/workflows/codeql.yml)

Plan a wedding, a birthday or a community event in one place. Shamiyana splits
your budget to the rupee, works a timeline back from your date, gives you a
checklist for every vendor and keeps the guest list. Google Gemini then
personalises it for your city, season, size and food rules, in English or
Hindi.

A shamiana is the tent that goes up over every Indian celebration. This one
holds the plan. It runs at https://shamiyana-nu.vercel.app.

It is built for families in India on purpose, with money in rupees and lakh,
veg and Jain menus, Hindi, and the weather and festivals of Indian cities in
mind.

## How it fits together

- The browser keeps the plans and does the arithmetic: budget, timeline,
  vendors and guests are pure functions in `lib/plan`, on screen before any AI
  call.
- The server holds the Gemini key. Three routes take the event facts only,
  check and limit every request, and stream or return answers that the page
  sanitizes before keeping (`lib/server`, `lib/ai`).
- No database. Plans live in local storage, share links in the URL fragment.

One request end to end, the decisions behind it and every limit are in
[ARCHITECTURE.md](ARCHITECTURE.md). How to work on it is in
[CONTRIBUTING.md](CONTRIBUTING.md).

## The problem

Families plan big events in group chats and a notebook. The money gets
committed before anyone adds it up, the caterer is booked after the venue has
gone, and the guest count the caterer needs is a guess. Generic AI chat can
write a nice list of ideas, but it can't keep a budget that adds up, it forgets
what was agreed, and it invents prices.

Shamiyana keeps the arithmetic and the schedule in code, where tests can pin
them down, and uses the model for what it is good at. The model judges and
suggests; the code adds up, schedules and checks.

## What it does

- **Budget.** A split for the event type, tilted by its details (a sangeet adds
  to music, a cleanup drive to waste handling), allocated in round hundreds
  that add up to the total exactly. Track agreed prices and payments per
  vendor; overspends are flagged per line and against the total. Shows the food
  budget per guest.
- **Timeline.** Every task back-scheduled from the event date with typical lead
  times. A wedding 116 days out says plainly that booking the venue was due in
  June, instead of hiding it. Tick tasks off, remove them with undo, add your
  own, export everything as an `.ics` calendar or one task at a time to Google
  Calendar.
- **Vendors.** One card per vendor type with status, agreed price, payments,
  notes, the questions worth asking before booking, and a Google Maps search
  for that vendor in your city. The app never invents vendor names or prices.
- **Guests.** Households with party size, group, reply and food preference.
  Counts are in people, not invitations, and the expected headcount can update
  the plan's guest count in one click. The list never leaves the browser.
- **AI ideas, streamed.** Theme, ideas across decor, food, music and more, a
  menu that respects veg, Jain or mixed, budget shifts with reasons (applied
  only when you click), extra tasks specific to the event, sharper vendor
  questions and the risks it sees for that date and place. The model is shown
  the checklist and vendor questions the app already has, so it adds to them.
- **Ask for changes.** "Bring it down to 15 lakh" or "add a mehndi night". The
  assistant answers and proposes changes; nothing changes until you tick and
  apply them, and every applied change can be undone.
- **Ideas from a photo.** Upload a venue, decor, invitation or outfit photo for
  a colour palette, ideas and practical notes. The photo is shrunk and stripped
  of location data in the browser before it is sent.
- **Share and keep.** A share link carries the plan in the URL fragment, which
  never reaches a server; guests, vendor notes and the notes for the AI are
  left out, and the copy makes its own AI ideas. Full JSON
  backup and restore, CSV for budget, checklist and guests, and a print layout.
- **Two languages.** Every screen, task, vendor question, error and policy is
  in English and Hindi, chosen per browser and rendered on the server.

Everything except the AI works without an API key.

## How the AI is used, and kept honest

All model calls go through Google Gemini via the Vercel AI SDK, on the server
only. The key is never sent to the browser.

| Feature            | Route              | Call                                | Output contract                                      |
| ------------------ | ------------------ | ----------------------------------- | ---------------------------------------------------- |
| Personalised plan  | `POST /api/plan`   | `streamText` with `Output.object`   | `lib/api/output-schemas.ts` `enrichmentOutputSchema` |
| Ask for changes    | `POST /api/refine` | `generateText` with `Output.object` | `refineOutputSchema`, six allowed operations         |
| Ideas from a photo | `POST /api/vision` | `generateText` with an image part   | `visionOutputSchema`                                 |

- The model gets facts, not freedom. Code computes the budget lines, the per
  guest figure and the days left, and passes them in (`lib/ai/prompts.ts`).
- Every answer is sanitized before it is stored or shown. Strings are cut on
  grapheme boundaries, lists capped, budget factors clamped to 0.5 to 1.5,
  categories the plan doesn't have dropped, colours checked as hex codes
  (`lib/plan/enrichment.ts`, `lib/plan/changes.ts`, `lib/api/vision-result.ts`).
- The event name is never sent, because it often holds a person's name. Emails,
  UPI IDs, phone and card numbers, PAN, GSTIN, Aadhaar, voter ID and passport numbers are removed from notes and chat
  first (`lib/ai/redact.ts`).
- A pattern screen in English and Hindi answers a chat message that tries to
  re-instruct the assistant with a fixed reply, and drops such sentences from
  notes (`lib/ai/guard.ts`). User text is then fenced in `<user_text>` tags
  with angle brackets stripped, and the system prompt says fenced text is data.
  Proposed changes need the user's approval, so an injected instruction can at
  most suggest something.
- Models are tried in order. The default chain is `gemini-3.5-flash-lite`,
  which answers a full plan in about five seconds, then `gemini-3.5-flash`,
  `gemini-3.6-flash` and `gemini-3.8-flash`, set by `GEMINI_MODELS`. Free-tier
  models return 429 or 503 under load often enough that one model is not
  enough. A stream that fails before its first token falls back to the next
  model (`lib/ai/fallback.ts`). One that fails midway is logged as `cut_off`
  and the page keeps what arrived (`components/planner/workspace/use-enrichment.ts`).
- A live eval set checks the prompts against the real model. Veg and Jain
  menus must stay within their rules, nothing may suggest alcohol or fireworks
  unasked, new tasks must fit the weeks left and not repeat the checklist, Hindi
  must come back in Devanagari, an instruction hidden in the notes must be
  ignored, a clear request must map to the right change and an off-topic one to
  none (`evals/prompts.eval.ts`, `npm run eval`).

## Judging criteria

### Code Quality

- Strict TypeScript with `noUncheckedIndexedAccess`, no `any`, no non-null
  assertions.
- ESLint with typescript-eslint strict and stylistic type-checked rules,
  @eslint-react strict, React Hooks, JSX a11y strict and SonarJS, plus a
  complexity cap of 10, 80 lines per function, 200 lines per file and one import
  per module, with types apart. Zero warnings allowed.
- One exported component per file, with only small private parts beside it; a
  context's provider keeps its hooks with it. One folder per planner tab
  (`components/planner/budget`, `timeline`, `vendors`, `guests`, `ideas`).
- Domain logic is pure functions in `lib/plan`, one concern per file. Every edit
  to a plan is a function from one record to the next, which makes undo a
  matter of keeping the previous value.
- Route logic takes its dependencies as arguments (`lib/server/deps.ts`), so
  tests drive it with a mock model and a fixed clock.

### Security

- Nonce-based Content-Security-Policy with `strict-dynamic` and no
  `unsafe-inline`, plus HSTS, `nosniff`, frame denial, COOP, CORP and a minimal
  Permissions-Policy (`proxy.ts`, `next.config.ts`).
- Every AI route checks same origin, content type, a body cap enforced while
  reading, a sliding-window rate limit per client and a daily request cap,
  shared by every instance through Upstash Redis, then
  validates the body with a strict Zod schema that the browser's calls are
  typed from too (`lib/server/http.ts`, `lib/api/contracts.ts`).
- Uploads are typed by their magic bytes, never by the declared type, and
  capped at 4 MB.
- A chat message that tries to re-instruct the assistant, in English or Hindi,
  gets a fixed reply and never reaches the model. Such sentences are dropped
  from notes too (`lib/ai/guard.ts`).
- Model output is rendered as text only; ESLint forbids
  `dangerouslySetInnerHTML`. Links are built from fixed bases with encoded
  values, never taken from the model.
- CSV cells that a spreadsheet would run as a formula are neutralised; iCalendar
  text is escaped and folded by bytes.
- Logs hold route, outcome, status, timing, model, whether the answer came from
  the cache and, for an unexpected error, its class name only. Errors are short
  codes with no internals. Config is validated at boot.
- Server code imports `server-only`, so the key and the handlers can never be
  bundled for the browser. `/api/health` says only that the server is up.
- CI runs `npm audit` and gitleaks over the full history, and CodeQL while the
  repository is public. Dependabot
  watches npm and Actions. Every Action is pinned to a commit SHA. The
  reporting contact is in `/.well-known/security.txt`. More in
  [SECURITY.md](SECURITY.md).

### Efficiency

- The budget, timeline and checklists are computed in the browser the moment
  the form is submitted. AI ideas stream in token by token after that.
- A finished answer is cached in server memory for six hours by a hash of the
  exact request, so a repeat costs nothing. "New ideas" skips the cache.
- Output tokens and time are capped per route (`lib/ai/run.ts`); a Gemini 2.5
  model, if one is configured, runs with thinking off for speed.
- Photos are resized to 1600 px JPEG in the browser before upload.
- No UI library, no icon font, no web fonts. Only the active language's
  dictionary is sent to the page.

### Testing

- 540 unit and component tests with 100% statement, branch, function and line
  coverage enforced in CI (`vitest.config.mts`).
- Property-style tests for the money split, adversarial tests for every input
  schema, model output sanitizer, upload sniffer, CSV guard and share link
  decoder, and route tests against a mock Gemini model for streaming, fallback,
  caching and every error path.
- 84 Playwright tests against the production build, with AI responses mocked
  at the network layer: everything on a desktop and a 360 px phone in Chromium,
  and the core flows on an iPhone in WebKit, Safari's engine.
- More in [TESTING.md](TESTING.md).

### Accessibility

- axe-core runs with the WCAG 2.2 AA, best-practice and experimental rules in
  the component tests on the form, each panel and the AI flows, and with colour
  contrast in a real browser on every tab, in light and dark themes and in
  Hindi.
- Semantic HTML, labelled controls, hints and errors tied to fields, an error
  summary that takes focus, WAI-ARIA tabs with arrow keys, a skip link and a
  keyboard-only end to end test.
- Focus never drops to the page when a control goes away, and changes such as
  a moved budget line are announced. Text in the other language, AI ideas or a
  typed title, carries its own `lang`.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`. Tested at 320
  and 360 px and at 200% text with no sideways scroll. More in
  [ACCESSIBILITY.md](ACCESSIBILITY.md).

### Problem Statement Alignment

Built for the brief "a GenAI-powered planning assistant that helps users
organize weddings, birthdays, and community events with budgets, timelines,
vendor checklists, and personalized ideas".

| Asked for                             | Where                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Weddings, birthdays, community events | Three event types with their own functions, honorees and kinds (`lib/plan/constants.ts`)     |
| Budgets                               | Exact split, shifts, agreed and paid tracking (`lib/plan/budget.ts`)                         |
| Timelines                             | Back-scheduled tasks by phase, calendar export (`lib/plan/timeline.ts`, `lib/export/ics.ts`) |
| Vendor checklists                     | Per-vendor status, questions and Maps search (`lib/plan/vendors.ts`)                         |
| Personalised ideas                    | Streamed Gemini ideas, refine chat, photo ideas (`lib/ai`)                                   |

## Getting started

Needs Node 24.

```sh
npm ci
cp .env.example .env.local   # add GOOGLE_GENERATIVE_AI_API_KEY to turn on AI
npm run dev
```

| Command                 | What it runs                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run verify`        | Lint, types, format, tests with coverage, audit, build and e2e |
| `npm run test:coverage` | Unit and component tests with the 100% gate                    |
| `npm run e2e`           | Playwright against `next start`; run `npm run build` first     |
| `npm run eval`          | The live prompt checks; needs a key and costs a few requests   |

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Vercel AI SDK 7 with the Google
provider, Zod 4. Tests with Vitest, Testing Library, axe-core and Playwright.

## Project layout

```text
app/                 pages, API routes, styles split by area
components/          site header and footer, language switch, policy article
components/planner/  the planner, and one folder per tab and for the workspace
components/ui/       one file per form control, tabs, notices, focus helpers
lib/plan/            budget, timeline, vendors, guests, schemas, record edits
lib/api/             request and answer contracts shared by the server and the browser
lib/shared/          ids, readers for untrusted values, plain-text hygiene, bounded maps
lib/ai/              prompts, injection guard, redaction, model chain, fallback, cache
lib/server/          env, request guard, rate limits shared through Redis, route handlers
lib/client/          API calls, local storage and files in the browser
lib/export/          iCalendar, CSV, share links, outbound links
lib/i18n/            English and Hindi dictionaries, formatting, policies
tests/  e2e/  evals/ unit and component tests, browser tests, live prompt checks
```

## Privacy

There are no accounts and no database. Plans live in the browser's local
storage. AI requests run on the free tier of the Gemini API, where Google
may use them to improve its products and people may read them; the app says
so and asks users to keep private details out. What goes to Gemini, what the server logs and what it keeps for how
long is listed in plain words on the in-app privacy page ([text](lib/i18n/legal.ts)).

## License

MIT
