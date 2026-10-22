import { expect, test } from "@playwright/test";

test("pages carry a nonce CSP and the hardening headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the page runs with no CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  // a blocked eval that the page catches never reaches the console, only this event
  await page.exposeFunction("reportViolation", (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as { reportViolation: (text: string) => Promise<void> })
        .reportViolation;
      void report(`${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}`);
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Wedding in Jaipur/ }).click();
  await page.getByRole("button", { name: "Make my plan" }).click();
  await page.getByRole("tab", { name: "Budget" }).click();
  expect(violations).toEqual([]);
});

test("AI routes refuse cross-site, wrong-type and oversized requests", async ({ request }) => {
  const crossSite = await request.post("/api/plan", {
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    },
    data: {},
  });
  expect(crossSite.status()).toBe(403);
  const wrongType = await request.post("/api/refine", {
    headers: { "content-type": "text/plain", "sec-fetch-site": "same-origin" },
    data: "hello",
  });
  expect(wrongType.status()).toBe(415);
  const huge = await request.post("/api/plan", {
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
    data: JSON.stringify({ notes: "x".repeat(20_000) }),
  });
  expect(huge.status()).toBe(413);
  expect(await huge.json()).toEqual({ error: "too_large" });
});

test("health says only that the server is up and is never cached", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("security.txt is served as plain text with the reporting contact", async ({ request }) => {
  const response = await request.get("/.well-known/security.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  expect(await response.text()).toContain(
    "Contact: https://github.com/Bisman-Singh/shamiyana/security/advisories/new",
  );
});
