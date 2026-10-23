import { buildChain, providerOptionsFor } from "@/lib/ai/models";

describe("models", () => {
  it("turns off thinking for 2.5 models only", () => {
    expect(providerOptionsFor("gemini-2.5-flash")).toEqual({
      google: { thinkingConfig: { thinkingBudget: 0 } },
    });
    expect(providerOptionsFor("gemini-3.5-flash")).toEqual({});
  });

  it("builds a chain only when a key is present", () => {
    expect(
      buildChain({
        GEMINI_MODELS: ["gemini-3.5-flash"],
        GOOGLE_GENERATIVE_AI_API_KEY: undefined,
      }),
    ).toBeNull();
    const chain = buildChain({
      GEMINI_MODELS: ["a-model", "b-model"],
      GOOGLE_GENERATIVE_AI_API_KEY: "k",
    });
    expect(chain?.map((s) => s.id)).toEqual(["a-model", "b-model"]);
  });
});
