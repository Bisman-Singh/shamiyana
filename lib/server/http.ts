import "server-only";
import { readAtMost } from "@/lib/plan/bytes";
import type { RateLimiter } from "./rate-limit";

/**
 * Request checks every AI route runs before touching the model: same origin
 * only, the expected content type, a per-client rate limit and a hard body
 * cap enforced while reading, so a missing or false Content-Length doesn't
 * help. Failures are short JSON error codes with no internals.
 */

export type ErrorCode =
  | "forbidden"
  | "unsupported_media_type"
  | "too_large"
  | "bad_request"
  | "invalid"
  | "rate_limited"
  | "ai_unavailable"
  | "ai_failed"
  | "daily_cap"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  forbidden: 403,
  unsupported_media_type: 415,
  too_large: 413,
  bad_request: 400,
  invalid: 422,
  rate_limited: 429,
  ai_unavailable: 503,
  ai_failed: 502,
  daily_cap: 503,
  internal: 500,
};

export function errorResponse(code: ErrorCode, headers: Record<string, string> = {}): Response {
  return Response.json(
    { error: code },
    { status: statusOf(code), headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export function statusOf(code: ErrorCode): number {
  return STATUS[code];
}

/** The client address as the hosting proxy reports it; spoofable only where no proxy sets it. */
export function clientKey(request: Request): string {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const fallback = forwarded === undefined || forwarded === "" ? "unknown" : forwarded;
  return addressBucket(h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? fallback);
}

/**
 * One key per IPv4 address, and per /64 for IPv6, since a single home or
 * phone connection is usually handed a whole /64 and could rotate through it.
 */
export function addressBucket(address: string): string {
  if (!address.includes(":")) return address;
  if (address.includes(".")) return address.slice(address.lastIndexOf(":") + 1);
  const [head = "", tail = ""] = address.toLowerCase().split("::");
  const left = head === "" ? [] : head.split(":");
  const right = tail === "" ? [] : tail.split(":");
  const gap = address.includes("::") ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array<string>(Math.max(0, gap)).fill("0"), ...right];
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/** Browsers send Sec-Fetch-Site and Origin on POST; anything cross-site is refused. */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return site === "same-origin";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === (host ?? new URL(request.url).host);
  } catch {
    return false;
  }
}

/** Reads at most `max` bytes of the body; null when it is larger. */
export async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!request.body) return new Uint8Array();
  return readAtMost(request.body, max);
}

export interface GuardOptions {
  limiter: RateLimiter;
  maxBytes: number;
  /** Media type the body must have, e.g. `application/json`. */
  type: "application/json" | "multipart/form-data";
}

export type Guarded =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; code: ErrorCode; headers?: Record<string, string> };

export async function guard(request: Request, options: GuardOptions): Promise<Guarded> {
  if (!isSameOrigin(request)) return { ok: false, code: "forbidden" };
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";")[0]?.trim().toLowerCase() !== options.type) {
    return { ok: false, code: "unsupported_media_type" };
  }
  const rate = options.limiter.check(clientKey(request));
  if (!rate.ok) {
    return { ok: false, code: "rate_limited", headers: { "Retry-After": String(rate.retryAfter) } };
  }
  const bytes = await readCapped(request, options.maxBytes);
  if (!bytes) return { ok: false, code: "too_large" };
  return { ok: true, bytes, contentType };
}

/** JSON from a guarded body; undefined when it isn't valid UTF-8 JSON. */
export function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}
