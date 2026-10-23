import { healthHandler } from "@/lib/server/health-handler";

describe("GET /api/health", () => {
  it("says only that the server is up, never how it is configured", async () => {
    const response = healthHandler();
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
