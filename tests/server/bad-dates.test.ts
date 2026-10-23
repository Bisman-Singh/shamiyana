import { planHandler } from "@/lib/server/plan-handler";
import { refineHandler } from "@/lib/server/refine-handler";
import { visionHandler } from "@/lib/server/vision-handler";
import {
  JPEG,
  formPost,
  generatingModel,
  jsonPost,
  spec,
  streamingModel,
  testDeps,
} from "../helpers/ai";
import { TODAY, weddingFacts } from "../helpers/fixtures";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("an impossible or oversized event date", () => {
  const bad = ["2027-02-30", "x".repeat(5_000)];

  it.each(bad)("is refused by the plan route without crashing (%#)", async (date) => {
    const response = await planHandler(() => testDeps([spec(streamingModel(["{}"]))]))(
      jsonPost({ facts: { ...weddingFacts, date }, locale: "en", today: TODAY }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "invalid" });
  });

  it.each(bad)("is refused by the refine route without crashing (%#)", async (date) => {
    const response = await refineHandler(() => testDeps([spec(generatingModel("{}"))]))(
      jsonPost({
        facts: { ...weddingFacts, date },
        factors: {},
        locale: "en",
        today: TODAY,
        history: [],
        message: "hi",
      }),
    );
    expect(response.status).toBe(422);
  });

  it("is refused by the photo route without crashing", async () => {
    const form = new FormData();
    form.set("image", new File([JPEG], "a.jpg", { type: "image/jpeg" }));
    form.set(
      "fields",
      JSON.stringify({
        facts: { ...weddingFacts, date: "2027-02-30" },
        locale: "en",
        today: TODAY,
      }),
    );
    const response = await visionHandler(() => testDeps([spec(generatingModel("{}"))]))(
      formPost(form),
    );
    expect(response.status).toBe(422);
  });
});
