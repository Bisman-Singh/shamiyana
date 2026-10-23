# Architecture

Shamiyana has two halves. The browser holds the plans and does all the
planning arithmetic. The server holds the Gemini key and makes the model
calls. There is no database and no account.

```text
browser                                        server (Vercel functions)
-------                                        -------------------------
brief form ──► lib/plan (budget, timeline,     proxy.ts: nonce CSP on pages
               vendors, guests) ──► screen
     │                                         /api/plan    ─┐
     └─ facts only ──► useObject, api.ts ───►  /api/refine  ─┼─► lib/server/*-handler.ts
                                               /api/vision  ─┘        │
local storage ◄── sanitized answer ◄──────────  stream or JSON ◄── lib/ai ──► Gemini
(lib/client/plan-store.ts)                                     shared limits ──► Upstash Redis
```

## One plan, end to end

1. The brief form keeps what is typed as a draft and parses it with the same
   strict schema the server uses (`lib/plan/draft.ts`, `lib/plan/schema.ts`).
2. `createRecord` builds the plan, and `usePlanView` derives everything shown
   from it: the budget split, the back-scheduled timeline, vendor cards and
   guest counts (`lib/plan`). This is pure code with no network, so the plan
   is on screen before any AI call starts.
3. `useEnrichment` asks `/api/plan` for ideas with the event facts only, never
   the title, guests or vendor notes (`factsOf`).
4. The route handler checks same origin, content type, the per-minute limit
   and the body size, then the strict request schema. A repeat brief is served
   from the answer cache. Otherwise the daily cap is taken and the model chain
   is tried in order (`lib/server/plan-handler.ts`, `lib/ai/plan-stream.ts`,
   `lib/ai/fallback.ts`).
5. The answer streams back as JSON text. The page shows it as it arrives,
   sanitized on every chunk, and saves the final sanitized version with the
   facts and language it was made for (`components/planner/workspace/use-enrichment.ts`,
   `lib/plan/enrichment.ts`).
6. Every edit after that is a function from one record to the next
   (`lib/plan/record.ts`), saved to local storage, which is what makes Undo a
   matter of keeping the previous record.

Refine and photo follow the same route path and return one JSON answer. A
refine answer is a reply plus proposed changes, and nothing applies until the
user ticks it (`lib/plan/changes.ts`).

## Decisions

- **Code computes, the model suggests.** Money, dates and counts come from
  code that tests pin down. The model gets those numbers as facts and may only
  shift a budget line within 0.5 to 1.5, add ideas, tasks and questions, and
  name risks. Every answer is cut to size and checked before it is kept.
- **The browser keeps the data.** Plans live in local storage, share links
  carry the plan in the URL fragment, and backups are files. The server never
  stores a plan, so there is nothing to breach.
- **Dependencies are passed in.** Route handlers take the model chain, cache,
  limits and clock as arguments, so tests run every path with a mock model and
  a fixed date (`tests/server/plan-handler.test.ts` and the other route tests).
- **Shared limits, local fallback.** Per-minute limits and daily caps live in
  Upstash Redis so every instance counts together. Redis only ever sees a keyed
  hash of the client address. If it fails or is slow, each instance's memory
  limits decide (`lib/server/shared-limits.ts`).
- **Untrusted text is screened, fenced and redacted.** A pattern screen drops
  sentences aimed at the assistant, contact and ID numbers are removed, and
  what remains is fenced as data (`lib/ai/guard.ts`, `lib/ai/redact.ts`,
  `lib/ai/prompts.ts`).
- **Two languages everywhere.** Pages render on the server in the chosen
  language. AI text keeps the language it was written in and is marked with
  `lang` when it differs from the page (`lib/i18n`).

## Limits and timings

| Path            | Limit                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `/api/plan`     | 8 a minute per client, 8 KB body, per model a first chunk in 15 s and the rest in 50 s             |
| `/api/refine`   | 20 a minute per client, 16 KB body, 30 s                                                           |
| `/api/vision`   | 6 a minute per client, 4 MB image, 40 s                                                            |
| All AI routes   | 2000 calls a day in total and 100 per client, by default                                           |
| Route functions | 60 s on Vercel                                                                                     |
| Model chain     | 55 s shared by every model one request tries; a failed model hands over to the next, with no retry |
| Redis           | 1 s per call, then the instance's memory limits decide                                             |
| Answer cache    | 6 hours, 200 answers or 2 million characters per instance                                          |

The budget, timeline and checklists never wait for the model; ideas fill in
as they stream.

## Where things live

| Folder               | Holds                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `app/`               | pages, the three AI routes, health, styles split by area              |
| `components/planner` | the planner, the workspace and one file per panel                     |
| `components/ui`      | fields, tabs, notices and the live region                             |
| `lib/plan`           | the domain: schemas, budget, timeline, vendors, guests, record edits  |
| `lib/shared`         | readers for untrusted values, plain-text hygiene, capped byte streams |
| `lib/ai`             | prompts, output schemas, the guard, model chain, fallback and cache   |
| `lib/server`         | env, request guard, rate limits, shared limits, logging, handlers     |
| `lib/api`            | request contracts shared by the routes and the browser's calls        |
| `lib/client`         | API calls, local storage and file handling in the browser             |
| `lib/export`         | iCalendar, CSV, share links and outbound links                        |
| `lib/i18n`           | English and Hindi messages, formatting, `lang` detection and policies |
