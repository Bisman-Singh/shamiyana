import { DailyCap, RateLimiter } from "@/lib/server/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit in a sliding window", () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 2, windowMs: 10_000, now: () => now });
    expect(limiter.check("a").ok).toBe(true);
    now = 4_000;
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("a")).toEqual({ ok: false, retryAfter: 6 });
    expect(limiter.check("b").ok).toBe(true);
    now = 10_001;
    expect(limiter.check("a").ok).toBe(true);
  });

  it("keeps memory bounded by dropping the least recently seen key", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 });
    for (const key of ["a", "b", "c", "d"]) limiter.check(key);
    expect(limiter.size).toBe(3);
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("d").ok).toBe(false);
  });

  it("refuses everything at a limit of zero", () => {
    const limiter = new RateLimiter({ limit: 0, windowMs: 5_000, now: () => 0 });
    expect(limiter.check("a")).toEqual({ ok: false, retryAfter: 5 });
  });

  it("uses the real clock and default size when none is given", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000 });
    expect(limiter.check("x").ok).toBe(true);
  });
});

describe("DailyCap", () => {
  it("limits each client separately under the instance ceiling", () => {
    const cap = new DailyCap(3, 2, () => 0);
    expect([cap.take("a"), cap.take("a"), cap.take("a")]).toEqual([true, true, false]);
    expect(cap.take("b")).toBe(true);
    expect(cap.take("c")).toBe(false);
  });

  it("forgets the least recent client past its memory bound", () => {
    const cap = new DailyCap(100, 1, () => 0, 2);
    expect([cap.take("a"), cap.take("b"), cap.take("c")]).toEqual([true, true, true]);
    expect(cap.take("a")).toBe(true);
    expect(cap.take("c")).toBe(false);
  });

  it("allows the cap per UTC day and resets the next day", () => {
    let now = Date.parse("2026-10-21T23:59:00Z");
    const cap = new DailyCap(2, 2, () => now);
    expect([cap.take(), cap.take(), cap.take()]).toEqual([true, true, false]);
    now = Date.parse("2026-10-22T00:00:01Z");
    expect(cap.take()).toBe(true);
    expect(new DailyCap(1).take()).toBe(true);
  });
});
