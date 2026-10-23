import { runRefine } from "@/lib/ai/refine";
import { brokenGenerateModel, generatingModel, runContext } from "@/tests/helpers/ai";
import { TODAY, weddingFacts } from "@/tests/helpers/fixtures";

describe("runRefine", () => {
  it("refine treats an empty or non-object reply as a failure", async () => {
    const input = {
      facts: weddingFacts,
      factors: {},
      locale: "en" as const,
      today: TODAY,
      history: [],
      message: "hi",
    };
    expect(await runRefine(runContext([generatingModel("")]), input)).toBeNull();
    expect(await runRefine(runContext([generatingModel("[1,2]")]), input)).toBeNull();
    expect(await runRefine(runContext([generatingModel("null")]), input)).toBeNull();
    expect(await runRefine(runContext([generatingModel('[{"reply":"x"}]')]), input)).toBeNull();
    expect(await runRefine(runContext([brokenGenerateModel()]), input)).toBeNull();
    const onFail = vi.fn();
    expect(await runRefine({ ...runContext([brokenGenerateModel()]), onFail }, input)).toBeNull();
    expect(onFail).toHaveBeenCalledWith("m0");
  });
});
