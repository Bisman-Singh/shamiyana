import { globalConfig } from "zod/v4/core";

describe("client instrumentation", () => {
  it("switches off the Zod eval probe before the app parses anything", async () => {
    await import("@/instrumentation-client");
    expect(globalConfig.jitless).toBe(true);
  });
});
