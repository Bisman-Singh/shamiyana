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

  it("checks Origin against the request's own scheme, host and port", () => {
    expect(isSameOrigin(req({ origin: "https://plan.test" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://evil.test", host: "plan.test" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "http://plan.test" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://plan.test:8443" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "not a url" }))).toBe(false);
  });

  it("ignores forwarded host headers a client could set", () => {
    expect(
      isSameOrigin(
        req({ origin: "https://evil.test", "x-forwarded-host": "evil.test", host: "evil.test" }),
      ),
    ).toBe(false);
  });

  it("refuses a request with neither header", () => {
    expect(isSameOrigin(req({}))).toBe(false);
    expect(isSameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });
});

describe("clientKey", () => {
  const all = {
    "x-vercel-forwarded-for": "1.1.1.1",
    "x-real-ip": "2.2.2.2",
    "x-forwarded-for": "3.3.3.3",
  };

  it("reads only Vercel's own header on Vercel", () => {
    const vercel = { VERCEL: "1" };
    expect(clientKey(req(all), vercel)).toBe("1.1.1.1");
    expect(clientKey(req({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }), vercel)).toBe(
      "unknown",
    );
  });

  it("reads x-real-ip, then the first forwarded hop, only behind a trusted proxy", () => {
    const proxy = { TRUST_PROXY: "1" };
    expect(clientKey(req(all), proxy)).toBe("2.2.2.2");
    expect(clientKey(req({ "x-forwarded-for": " 3.3.3.3 , 4.4.4.4" }), proxy)).toBe("3.3.3.3");
    expect(clientKey(req({ "x-forwarded-for": "" }), proxy)).toBe("unknown");
    expect(clientKey(req({}), proxy)).toBe("unknown");
  });

  it("puts every client in one key when no proxy is trusted, so a forged header gains nothing", () => {
    expect(clientKey(req(all), {})).toBe("unknown");
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
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
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
    const key = (ip: string) =>
      clientKey(new Request("https://plan.test", { headers: { "x-vercel-forwarded-for": ip } }), {
        VERCEL: "1",
      });
    expect(key("2001:db8:1:2::a")).toBe("2001:db8:1:2::/64");
    expect(key("2001:db8:1:2:ffff::b")).toBe("2001:db8:1:2::/64");
  });
});
