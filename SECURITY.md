# Security

## Reporting a problem

Please use GitHub's private vulnerability reporting on this repository
(Security tab, "Report a vulnerability"). Don't open a public issue for a
security problem. The same contact is published at `/.well-known/security.txt`.

## What there is to protect

Shamiyana has no accounts and no database. Plans, guest lists and vendor notes
stay in the user's browser. The server holds one secret, the Gemini API key,
and spends money on every AI call. So the threats that matter are:

| Threat                           | Controls                                                                                                                                                                                                                                                                                                                                                                                          | Where                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Key theft                        | Key read on the server only, in modules that import `server-only` so the build fails if one reaches the browser; validated at boot, never logged; the health check says only that the server is up; the client talks only to its own origin (`connect-src 'self'`)                                                                                                                                | `lib/server/env.ts`, `proxy.ts`                                                        |
| Spend abuse                      | Same-origin check, per-client sliding-window limits of 8, 20 and 6 per minute for plan, refine and photo, a daily cap and a smaller one per client, all shared by every instance through Upstash Redis, which sees only a keyed hash of the client address, IPv6 clients grouped by /64, output token and time caps, and a six-hour answer cache                                                  | `lib/server/http.ts`, `lib/server/shared-limits.ts`, `lib/ai/run.ts`                   |
| Malformed or hostile input       | Strict Zod schemas that reject unknown keys and bound every string and number; bodies capped while being read; control and bidi characters stripped; images typed by magic bytes and capped at 4 MB; anything unexpected answered with a bare 500                                                                                                                                                 | `lib/server/requests.ts`, `lib/plan/schema.ts`, `lib/server/handlers.ts`               |
| Prompt injection                 | A pattern screen in English and Hindi: a chat message that tries to re-instruct the assistant gets a fixed reply with no model call, and such sentences are dropped from notes and earlier turns; user text fenced and stripped of angle brackets; the system prompt treats it as data; model output sanitized and bounded; plan changes arrive unticked and apply only after the user ticks them | `lib/ai/guard.ts`, `lib/ai/prompts.ts`, `lib/plan/changes.ts`                          |
| XSS through model or user text   | React escapes all text; `dangerouslySetInnerHTML` is banned by lint; a nonce CSP with `strict-dynamic` and no `unsafe-inline`; links built from fixed bases                                                                                                                                                                                                                                       | `eslint.config.mjs`, `proxy.ts`, `lib/export/links.ts`                                 |
| Personal data leaving the device | The AI routes receive the event facts only, never its name, the guest list, vendor notes or amounts paid; common formats of contact and ID numbers are removed from notes and chat; photo EXIF dropped in the browser; share links use the URL fragment and leave out guests and notes                                                                                                            | `lib/plan/schema.ts`, `lib/ai/redact.ts`, `lib/client/files.ts`, `lib/export/share.ts` |
| Hostile files coming back in     | Share links and backups validated with the same strict schemas, and their AI text cleaned again; inflated share data capped at 128 KB; CSV formula injection neutralised                                                                                                                                                                                                                          | `lib/export/share.ts`, `lib/client/plan-store.ts`, `lib/export/csv.ts`                 |
| Clickjacking and downgrade       | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, COOP and CORP                                                                                                                                                                                                                                                                                                                            | `next.config.ts`, `proxy.ts`                                                           |
| Supply chain                     | Exact dependency pins and a lockfile, `npm audit` in CI, Dependabot, gitleaks over the full history, CodeQL, Actions pinned to commit SHAs                                                                                                                                                                                                                                                        | `.github/`                                                                             |

## Accepted limits

- If Redis fails or takes over a second to answer, each instance falls back to
  its own memory limits until it answers again, so for that time the effective
  limit multiplies by the number of instances. Requests are never let through
  unlimited.
- The answer cache lives in each instance's memory, so the same brief can cost
  one model call per instance.
- The client address comes from forwarding headers. Vercel overwrites them
  and does not forward client-sent values, per its request headers
  documentation; on any other host, run behind a proxy that does the same.
- A plan in a share link can be read by anyone who has the link. The share
  dialog says so.
