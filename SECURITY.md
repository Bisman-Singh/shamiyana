# Security

## Reporting a problem

Please use GitHub's private vulnerability reporting on this repository
(Security tab, "Report a vulnerability"). Don't open a public issue for a
security problem.

## What there is to protect

Shamiyana has no accounts and no database. Plans, guest lists and vendor notes
stay in the user's browser. The server holds one secret, the Gemini API key,
and spends money on every AI call. So the threats that matter are:

| Threat                           | Controls                                                                                                                                                                                                                         | Where                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Key theft                        | Key read on the server only, validated at boot, never logged or sent to the browser; the client talks only to its own origin (`connect-src 'self'`)                                                                              | `lib/server/env.ts`, `proxy.ts`                                                       |
| Spend abuse                      | Same-origin check, per-client sliding-window limits (8, 20 and 6 per minute for plan, refine and photo), a daily cap per instance, output token and time caps, and a six-hour answer cache                                       | `lib/server/http.ts`, `lib/server/rate-limit.ts`, `lib/ai/run.ts`                     |
| Malformed or hostile input       | Strict Zod schemas that reject unknown keys and bound every string and number; bodies capped while being read; control and bidi characters stripped; images typed by magic bytes and capped at 4 MB                              | `lib/server/requests.ts`, `lib/plan/schema.ts`, `lib/plan/text.ts`                    |
| Prompt injection                 | User text fenced and stripped of angle brackets; the system prompt treats it as data; model output sanitized and bounded; plan changes proposed only, applied after the user ticks them                                          | `lib/ai/prompts.ts`, `lib/plan/changes.ts`                                            |
| XSS through model or user text   | React escapes all text; `dangerouslySetInnerHTML` is banned by lint; a nonce CSP with `strict-dynamic` and no `unsafe-inline`; links built from fixed bases                                                                      | `eslint.config.mjs`, `proxy.ts`, `lib/export/links.ts`                                |
| Personal data leaving the device | The event name, guest list, vendor notes and amounts paid are never sent; contact and ID numbers removed from notes and chat; photo EXIF dropped in the browser; share links use the URL fragment and leave out guests and notes | `lib/ai/prompts.ts`, `lib/ai/redact.ts`, `lib/client/files.ts`, `lib/export/share.ts` |
| Hostile files coming back in     | Share links and backups validated with the same strict schemas; inflated share data capped at 128 KB; CSV formula injection neutralised                                                                                          | `lib/export/share.ts`, `lib/client/plan-store.ts`, `lib/export/csv.ts`                |
| Clickjacking and downgrade       | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, COOP and CORP                                                                                                                                                           | `next.config.ts`, `proxy.ts`                                                          |
| Supply chain                     | Exact dependency pins and a lockfile, `npm audit` in CI, Dependabot, gitleaks over the full history, CodeQL, Actions pinned to commit SHAs                                                                                       | `.github/`                                                                            |

## Accepted limits

- Rate limits and the cache live in each server instance's memory. With several
  instances the effective limit multiplies; there is no shared store to keep
  costs at zero.
- The client address comes from the hosting proxy's headers. Run behind a
  proxy that sets them.
- A plan in a share link can be read by anyone who has the link. The share
  dialog says so.
