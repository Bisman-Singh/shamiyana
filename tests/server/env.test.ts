import { EnvError, readEnv } from "@/lib/server/env";

describe("readEnv", () => {
  it("applies defaults and treats an empty key as no key", () => {
    expect(readEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "  " })).toEqual({
      GOOGLE_GENERATIVE_AI_API_KEY: undefined,
      GEMINI_MODELS: [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-3.8-flash",
      ],
      AI_DAILY_REQUEST_CAP: 2000,
      AI_DAILY_CLIENT_CAP: 100,
      redis: null,
    });
  });

  it("parses a model list and a cap", () => {
    const env = readEnv({
      GOOGLE_GENERATIVE_AI_API_KEY: "k",
      GEMINI_MODELS: " a-1 , ,b.2 ",
      AI_DAILY_REQUEST_CAP: "50",
    });
    expect(env).toEqual({
      GOOGLE_GENERATIVE_AI_API_KEY: "k",
      GEMINI_MODELS: ["a-1", "b.2"],
      AI_DAILY_REQUEST_CAP: 50,
      AI_DAILY_CLIENT_CAP: 100,
      redis: null,
    });
  });

  it("names the bad variables without echoing their values", () => {
    const attempt = () =>
      readEnv({
        GEMINI_MODELS: "Bad Model;rm",
        AI_DAILY_REQUEST_CAP: "-3",
        GOOGLE_GENERATIVE_AI_API_KEY: "secret-value",
      });
    expect(attempt).toThrow(EnvError);
    expect(attempt).toThrow("Invalid server environment: GEMINI_MODELS.0, AI_DAILY_REQUEST_CAP");
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toContain("secret-value");
    }
  });

  it("takes a RATE_LIMIT_SECRET of at least 32 characters, or none", () => {
    expect(readEnv({ RATE_LIMIT_SECRET: "k".repeat(32) }).RATE_LIMIT_SECRET).toHaveLength(32);
    expect(readEnv({ RATE_LIMIT_SECRET: "" }).RATE_LIMIT_SECRET).toBeUndefined();
    expect(() => readEnv({ RATE_LIMIT_SECRET: "short" })).toThrow(
      "Invalid server environment: RATE_LIMIT_SECRET",
    );
  });

  it("takes TRUST_PROXY as 0 or 1 only, so a typo fails the deploy instead of merging every client", () => {
    expect(readEnv({ TRUST_PROXY: "1" }).TRUST_PROXY).toBe("1");
    expect(readEnv({ TRUST_PROXY: "" }).TRUST_PROXY).toBeUndefined();
    expect(() => readEnv({ TRUST_PROXY: "true" })).toThrow(
      "Invalid server environment: TRUST_PROXY",
    );
  });

  it("takes the Redis pair together and over https only, never echoing the token", () => {
    expect(
      readEnv({ KV_REST_API_URL: "https://kv.example.test", KV_REST_API_TOKEN: "tok" }).redis,
    ).toEqual({ url: "https://kv.example.test", token: "tok" });
    expect(readEnv({ KV_REST_API_URL: " ", KV_REST_API_TOKEN: "" }).redis).toBeNull();
    expect(() => readEnv({ KV_REST_API_URL: "https://kv.example.test" })).toThrow(
      "Invalid server environment: KV_REST_API_TOKEN",
    );
    expect(() => readEnv({ KV_REST_API_TOKEN: "tok" })).toThrow(
      "Invalid server environment: KV_REST_API_URL",
    );
    try {
      readEnv({ KV_REST_API_URL: "http://kv.example.test", KV_REST_API_TOKEN: "secret-token" });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toBe("EnvError: Invalid server environment: KV_REST_API_URL");
    }
  });

  it("reads process.env by default", () => {
    expect(readEnv().GEMINI_MODELS.length).toBeGreaterThan(0);
  });
});
