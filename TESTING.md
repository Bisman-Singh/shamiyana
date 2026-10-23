# Testing

```sh
npm run test:coverage   # unit and component tests, 100% coverage gate
npm run build && npm run e2e
npm run eval            # live prompt checks, needs GOOGLE_GENERATIVE_AI_API_KEY
```

## Layers

| Layer      | Tool                                     | What it covers                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain     | Vitest                                   | Budget split, timeline scheduling, vendors, guests, record edits, change parsing, schemas, text hygiene                                                                                                                          |
| AI layer   | Vitest with `MockLanguageModelV4`        | Prompts, the injection guard in both languages, redaction, sanitizers, model fallback, cache, the three runners                                                                                                                  |
| Routes     | Vitest                                   | Every guard and error path of `/api/plan`, `/api/refine`, `/api/vision` and `/api/health`, with streaming, fallback and the shared limits                                                                                        |
| Components | Vitest, Testing Library, jsdom, axe-core | The planner end to end in the DOM: create, stream, edit, undo, share, backup, every panel, both languages                                                                                                                        |
| Browser    | Playwright with @axe-core/playwright     | The production build on desktop and a 360 px phone: flows, the photo upload, downloads, share links across browsers, CSP and headers, WCAG 2.2 AA with contrast on every tab and on the dialog, proposal, photo and error states |
| Prompts    | Vitest against the real API              | Food rules, Hindi output, injection in notes, refine mapping                                                                                                                                                                     |

## Rules the suite follows

- The app has no test hooks. Browser tests mock the AI routes at the network
  layer; component tests stub `fetch`; route tests inject a mock model.
- Test data uses relation words such as Nani, Mausi and Chachaji, and city
  names. Never real people.
- Coverage is 100% for statements, branches, functions and lines across `app`,
  `components`, `lib`, `proxy.ts` and `next.config.ts`. Branches that could not
  happen were removed from the code rather than excluded from coverage.
- One test file per module or panel, in folders that mirror the source, none
  over 300 lines.
- The shared limits are tested with stand-ins for Upstash and with the real
  client pointed at a closed port, so the memory fallback is exercised for real.
- Property-style checks use a seeded PRNG so a failure reproduces.
- The evals are not part of CI because they cost real requests.
