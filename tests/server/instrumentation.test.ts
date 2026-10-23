import { EnvError } from "@/lib/server/env";
import type * as Log from "@/lib/server/log";
import { register } from "@/instrumentation";

const logNotice = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/log", async (load) => ({ ...(await load<typeof Log>()), logNotice }));

afterEach(() => {
  vi.unstubAllEnvs();
  logNotice.mockClear();
});

describe("register", () => {
  it("does nothing outside the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("AI_DAILY_REQUEST_CAP", "lots");
    await register();
    expect(logNotice).not.toHaveBeenCalled();
  });

  it("says at startup that AI is off when there is no key", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    await register();
    expect(logNotice).toHaveBeenCalledExactlyOnceWith({ event: "ai_off", reason: "no_api_key" });
  });

  it("stays quiet when a key is set", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    await register();
    expect(logNotice).not.toHaveBeenCalled();
  });

  it("fails fast on a bad setting", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("AI_DAILY_REQUEST_CAP", "lots");
    await expect(register()).rejects.toBeInstanceOf(EnvError);
  });
});
