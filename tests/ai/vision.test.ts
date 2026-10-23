import { runVision } from "@/lib/ai/vision";
import { JPEG, brokenGenerateModel, generatingModel, runContext } from "../helpers/ai";
import { TODAY, weddingFacts } from "../helpers/fixtures";

describe("runVision", () => {
  it("vision answers from the first model that sees something", async () => {
    const good = generatingModel(
      JSON.stringify({ kind: "venue", palette: [{ name: "Teal", hex: "#007777" }] }),
    );
    const result = await runVision(runContext([brokenGenerateModel(), good]), {
      facts: weddingFacts,
      locale: "en",
      today: TODAY,
      image: JPEG,
      mediaType: "image/jpeg",
    });
    expect(result).toMatchObject({ kind: "venue", model: "m1" });
  });
});
