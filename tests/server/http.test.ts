import {
  addressBucket,
  clientKey,
  errorResponse,
  guard,
  isSameOrigin,
  parseJson,
  readCapped,
  statusOf,
} from "@/lib/server/http";
import { RateLimiter } from "@/lib/server/rate-limit";
import { SAME_ORIGIN, jsonPost } from "../helpers/ai";

const req = (headers: Record<string, string>, body?: BodyInit) =>
  new Request("https://plan.test/api/x", { method: "POST", headers, body });

describe("isSameOrigin", () => {
  it("accepts a same-origin browser request", () => {
    expect(isSameOrigin(req(SAME_ORIGIN))).toBe(true);
  });

  it("refuses cross-site and same-site requests", () => {
    expect(isSameOrigin(req({ ...SAME_ORIGIN, "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req({ ...SAME_ORIGIN, "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("checks Origin against the host the proxy reports", () => {
    expect(isSameOrigin(req({ origin: "https://evil.test", host: "plan.test" }))).toBe(false);
    expect(
      isSameOrigin(
        req({ origin: "https://plan.test", "x-forwarded-host": "plan.test", host: "internal" }),
      ),
    ).toBe(true);
    expect(isSameOrigin(req({ origin: "https://plan.test" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "not a url", host: "plan.test" }))).toBe(false);
  });

  it("refuses a request with neither header", () => {
    expect(isSameOrigin(req({}))).toBe(false);
    expect(isSameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });
});

describe("clientKey", () => {
  it("prefers the platform header, then x-real-ip, then the first forwarded hop", () => {
    expect(clientKey(req({ "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" }))).toBe(
      "1.1.1.1",
    );
    expect(clientKey(req({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }))).toBe(
      "2.2.2.2",
    );
    expect(clientKey(req({ "x-forwarded-for": " 3.3.3.3 , 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientKey(req({ "x-forwarded-for": "" }))).toBe("unknown");
    expect(clientKey(req({}))).toBe("unknown");
  });
});

describe("readCapped", () => {
  it("reads a body within the cap", async () => {
    expect(new TextDecoder().decode((await readCapped(req({}, "hello"), 10)) ?? undefined)).toBe(
      "hello",
    );
  });

  it("refuses by declared length before reading", async () => {
    expect(await readCapped(req({ "content-length": "999" }, "x"), 10)).toBeNull();
  });

  it("refuses a body that grows past the cap while streaming", async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(6));
        c.enqueue(new Uint8Array(6));
        c.close();
      },
    });
    const streamed = new Request("https://plan.test", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(await readCapped(streamed, 10)).toBeNull();
  });

  it("returns an empty body when there is none", async () => {
    expect(await readCapped(new Request("https://plan.test"), 10)).toEqual(new Uint8Array());
  });
});

describe("guard", () => {
  const options = () => ({
    limiter: new RateLimiter({ limit: 1, windowMs: 60_000 }),
    maxBytes: 64,
    type: "application/json" as const,
  });

  it("passes a good request through with its bytes", async () => {
    const result = await guard(jsonPost({ a: 1 }), options());
    expect(result.ok && new TextDecoder().decode(result.bytes)).toBe('{"a":1}');
  });

  it("stops cross-site, wrong type, oversize and repeat requests", async () => {
    expect(await guard(jsonPost({}, { "sec-fetch-site": "cross-site" }), options())).toMatchObject({
      code: "forbidden",
    });
    expect(await guard(jsonPost({}, { "content-type": "text/plain" }), options())).toMatchObject({
      code: "unsupported_media_type",
    });
    expect(
      await guard(
        new Request("https://plan.test", { method: "POST", headers: SAME_ORIGIN }),
        options(),
      ),
    ).toMatchObject({
      code: "unsupported_media_type",
    });
    expect(await guard(jsonPost({ big: "x".repeat(100) }), options())).toMatchObject({
      code: "too_large",
    });
    const once = options();
    await guard(jsonPost({}), once);
    expect(await guard(jsonPost({}), once)).toMatchObject({
      code: "rate_limited",
      headers: { "Retry-After": "60" },
    });
  });

  it("accepts a content type with parameters", async () => {
    expect(
      (await guard(jsonPost({}, { "content-type": "Application/JSON; charset=utf-8" }), options()))
        .ok,
    ).toBe(true);
  });
});

describe("parseJson and errors", () => {
  it("parses UTF-8 JSON and rejects anything else", () => {
    expect(parseJson(new TextEncoder().encode('{"x":"मेला"}'))).toEqual({ x: "मेला" });
    expect(parseJson(new TextEncoder().encode("{oops"))).toBeUndefined();
    expect(parseJson(new Uint8Array([0xff, 0xfe]))).toBeUndefined();
  });

  it("answers with a code and the matching status, never cached", async () => {
    const response = errorResponse("rate_limited", { "Retry-After": "5" });
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("5");
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(statusOf("ai_unavailable")).toBe(503);
  });
});

describe("addressBucket", () => {
  it.each([
    ["203.0.113.9", "203.0.113.9"],
    ["2001:db8:85a3:12:8a2e:370:7334:1", "2001:db8:85a3:12::/64"],
    ["2001:DB8:0:0:1::5", "2001:db8:0:0::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["fe80::", "fe80:0:0:0::/64"],
    ["::ffff:198.51.100.7", "198.51.100.7"],
    ["2001:0db8:0000:0042::", "2001:db8:0:42::/64"],
  ])("keys %s as %s", (address, key) => {
    expect(addressBucket(address)).toBe(key);
  });

  it("gives every address in one /64 the same rate-limit key", () => {
    const req = (ip: string) => new Request("https://plan.test", { headers: { "x-real-ip": ip } });
    expect(clientKey(req("2001:db8:1:2::a"))).toBe(clientKey(req("2001:db8:1:2:ffff::b")));
  });
});
