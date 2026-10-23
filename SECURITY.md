# Security

## Reporting a problem

Please use GitHub's private vulnerability reporting on this repository
(Security tab, "Report a vulnerability"). Don't open a public issue for a
security problem. The same contact is published at `/.well-known/security.txt`.

## Supported versions

Only the live site and the `main` branch get fixes. There are no releases to
patch separately.

## Scope

In scope: this repository and the deployed site. Out of scope: the hosting,
AI and Redis providers themselves, findings that need a compromised device or
browser, and load tests that would spend the daily AI allowance.

## What there is to protect

Shamiyana has no accounts and no database. Plans, guest lists and vendor notes
stay in the user's browser. The server holds one secret, the Gemini API key,
and spends money on every AI call. So the threats that matter are:

| Threat                           | Controls                                                                                                                                                                                                                                                                                                                                                                                                  | Where                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Key theft                        | Key read on the server only, in modules that import `server-only` so the build fails if one reaches the browser; validated at boot, never logged; the health check says only that the server is up; the client talks only to its own origin (`connect-src 'self'`)                                                                                                                                        | `lib/server/env.ts`, `proxy.ts`                                                                 |
| Spend abuse                      | Same-origin check against cross-site requests, per-client sliding-window limits of 8, 20 and 6 per minute for plan, refine and photo, a daily cap and a smaller one per client, all shared by every instance through Upstash Redis, which sees only a hash of the client address keyed with a secret it never holds, IPv6 clients grouped by /64, output token and time caps, and a six-hour answer cache | `lib/server/http.ts`, `lib/server/shared-limits.ts`, `lib/ai/run.ts`                            |
| Malformed or hostile input       | Strict Zod schemas that reject unknown keys and bound every string and number; bodies capped while being read; control characters and bidi marks stripped (`lib/shared/plain-text.ts`); images typed by magic bytes and capped at 4 MB; anything unexpected answered with a bare 500                                                                                                                      | `lib/api/contracts.ts`, `lib/server/images.ts`, `lib/plan/schema.ts`, `lib/server/route-kit.ts` |
| Prompt injection                 | A pattern screen in English and Hindi: a chat message that tries to re-instruct the assistant gets a fixed reply with no model call, and such sentences are dropped from notes and earlier turns; user text fenced and stripped of angle brackets; the system prompt treats it as data; model output sanitized and bounded; plan changes arrive unticked and apply only after the user ticks them         | `lib/ai/guard.ts`, `lib/ai/prompts.ts`, `lib/plan/changes.ts`                                   |
| XSS through model or user text   | React escapes all text; `dangerouslySetInnerHTML` is banned by lint; a nonce CSP with `strict-dynamic` and no `unsafe-inline`; links built from fixed bases                                                                                                                                                                                                                                               | `eslint.config.mjs`, `proxy.ts`, `lib/export/links.ts`                                          |
| Personal data leaving the device | The AI routes receive the event facts only, never its name, the guest list, vendor notes or amounts paid; common formats of contact and ID numbers are removed from notes and chat; photo EXIF dropped in the browser; share links use the URL fragment and leave out guests, vendor notes and the notes for the AI                                                                                       | `lib/plan/schema.ts`, `lib/ai/redact.ts`, `lib/client/files.ts`, `lib/export/share.ts`          |
| Hostile files coming back in     | Share links and backups validated with the same strict schemas; a share link never carries AI ideas, any it is made to carry are dropped, and its tasks arrive as the recipient's own, so nobody can pass text off as the model's; a backup's AI text is cleaned again; inflated share data capped at 128 KB; CSV formula injection neutralised                                                           | `lib/export/share.ts`, `lib/client/plan-store.ts`, `lib/export/csv.ts`                          |
| Clickjacking and downgrade       | `frame-ancestors 'none'` on pages and a deny-all policy on the API, `X-Frame-Options: DENY`, HSTS, COOP and CORP                                                                                                                                                                                                                                                                                          | `next.config.ts`, `proxy.ts`                                                                    |
| Supply chain                     | Exact dependency pins and a lockfile, `npm audit` in CI, Dependabot, gitleaks over the full history, CodeQL while the repository is public, Actions pinned to commit SHAs                                                                                                                                                                                                                                 | `.github/`                                                                                      |

## Accepted limits

- The daily total is a spend ceiling shared by everyone. Many addresses
  together can use it up for the day; then the AI routes answer `daily_cap` and
  the rest of the planner keeps working. The cost stays bounded either way.
- If Redis fails or takes over a second to answer, each instance falls back to
  its own memory limits until it answers again, so for that time the effective
  limit multiplies by the number of instances. Requests are never let through
  unlimited.
- The answer cache lives in each instance's memory, so the same brief can cost
  one model call per instance.
- On Vercel the client address comes only from `x-vercel-forwarded-for`, which
  Vercel sets on every request and a client cannot override. On another host,
  `x-real-ip` and `x-forwarded-for` count only when `TRUST_PROXY=1` says a proxy
  in front overwrites them; without it every client shares one limit.
- A plan in a share link can be read by anyone who has the link. The share
  dialog says so.
