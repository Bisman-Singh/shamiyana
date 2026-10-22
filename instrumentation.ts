/** Validates server configuration at startup so a bad value fails fast. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { readEnv } = await import("@/lib/server/env");
  const { logNotice } = await import("@/lib/server/log");
  const env = readEnv();
  if (env.GOOGLE_GENERATIVE_AI_API_KEY === undefined) {
    logNotice({ event: "ai_off", reason: "no_api_key" });
  }
}
