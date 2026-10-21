import { EnvError, readEnv } from "@/lib/server/env";
import { planRequestSchema, sniffImage } from "@/lib/server/requests";
import { TODAY, weddingFacts } from "../fixtures";
import { FIXED_NOW, JPEG, PNG, WEBP } from "../helpers/ai";

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

  it("reads process.env by default", () => {
    expect(readEnv().GEMINI_MODELS.length).toBeGreaterThan(0);
  });
});

describe("request schemas", () => {
  it("accepts a device date a day either side of the server", () => {
    const schema = planRequestSchema(FIXED_NOW);
    for (const today of ["2026-10-20", TODAY, "2026-10-22"]) {
      expect(schema.safeParse({ facts: weddingFacts, locale: "en", today }).success).toBe(true);
    }
    expect(schema.parse({ facts: weddingFacts, locale: "hi", today: TODAY }).fresh).toBe(false);
  });
});

describe("sniffImage", () => {
  it("recognises JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(WEBP)).toBe("image/webp");
  });

  it.each([
    ["SVG", new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")],
    ["GIF", new TextEncoder().encode("GIF89a......")],
    ["RIFF that is not WebP", new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WAVEfmt ")],
    ["a short RIFF", new TextEncoder().encode("RIFF")],
    ["nothing", new Uint8Array()],
  ])("rejects %s", (_label, bytes) => {
    expect(sniffImage(bytes)).toBeNull();
  });
});
