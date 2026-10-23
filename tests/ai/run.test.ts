import { runRefine } from "@/lib/ai/refine";
import { TODAY, weddingFacts } from "@/tests/helpers/fixtures";

describe("generateSanitized", () => {
  // through the refine runner, its simplest caller
  it("answers nothing for an empty chain", async () => {
    const onFail = vi.fn();
    const failing = { chain: [], signal: new AbortController().signal, onFail };
    expect(
      await runRefine(failing, {
        facts: weddingFacts,
        factors: {},
        locale: "en",
        today: TODAY,
        history: [],
        message: "x",
      }),
    ).toBeNull();
    expect(onFail).not.toHaveBeenCalled();
  });
});
