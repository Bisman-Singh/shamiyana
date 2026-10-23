import type { MockLanguageModelV4 } from "ai/test";
import { AnswerCache } from "@/lib/ai/cache";
import { lookupPlan, runRefine, runVision, streamPlan, type PlanInput } from "@/lib/ai/run";
import { TODAY, weddingFacts } from "../helpers/fixtures";
import {
  JPEG,
  brokenGenerateModel,
  cutOffModel,
  generatingModel,
  spec,
  streamingModel,
} from "../helpers/ai";

describe("plan streams", () => {
  const input: PlanInput = { facts: weddingFacts, locale: "en", today: TODAY, fresh: true };

  async function drain(stream: ReadableStream<string>): Promise<string> {
    let text = "";
    for await (const chunk of stream) text += chunk;
    return text;
  }

  it("still delivers what arrived when a stream ends without finishing and nobody listens", async () => {
    const cache = new AnswerCache();
    const { key } = await lookupPlan(cache, input);
    const ctx = {
      chain: [spec(cutOffModel(['{"theme":'], "silent"))],
      signal: new AbortController().signal,
    };
    const opened = await streamPlan(ctx, cache, key, input);
    expect(await drain(opened?.stream ?? new ReadableStream())).toBe('{"theme":');
  });

  it.each(["silent", "length"] as const)(
    "reports a stream that ends early by %s, after passing on what arrived",
    async (ending) => {
      const cache = new AnswerCache();
      const { key } = await lookupPlan(cache, input);
      const onCutOff = vi.fn();
      const opened = await streamPlan(
        {
          chain: [spec(cutOffModel(['{"theme":'], ending), "short")],
          signal: new AbortController().signal,
          onCutOff,
        },
        cache,
        key,
        input,
      );
      expect(await drain(opened?.stream ?? new ReadableStream())).toBe('{"theme":');
      expect(onCutOff).toHaveBeenCalledWith("short");
    },
  );

  it("does not report a complete answer", async () => {
    const cache = new AnswerCache();
    const { key } = await lookupPlan(cache, input);
    const onCutOff = vi.fn();
    const opened = await streamPlan(
      { chain: [spec(streamingModel(["{}"]))], signal: new AbortController().signal, onCutOff },
      cache,
      key,
      input,
    );
    await drain(opened?.stream ?? new ReadableStream());
    expect(onCutOff).not.toHaveBeenCalled();
  });

  it("does not report a cut when the client is the one who left", async () => {
    const cache = new AnswerCache();
    const { key } = await lookupPlan(cache, input);
    const client = new AbortController();
    const onCutOff = vi.fn();
    const model = cutOffModel(["{", '"theme"', ":"], "silent", 30);
    const opened = await streamPlan(
      { chain: [spec(model)], signal: client.signal, onCutOff },
      cache,
      key,
      input,
    );
    client.abort();
    await drain(opened?.stream ?? new ReadableStream()).catch(() => "");
    expect(onCutOff).not.toHaveBeenCalled();
  });
});

describe("runners", () => {
  const ctx = (models: MockLanguageModelV4[]) => ({
    chain: models.map((m, i) => spec(m, `m${i}`)),
    signal: new AbortController().signal,
  });

  it("refine treats an empty or non-object reply as a failure", async () => {
    const input = {
      facts: weddingFacts,
      factors: {},
      locale: "en" as const,
      today: TODAY,
      history: [],
      message: "hi",
    };
    expect(await runRefine(ctx([generatingModel("")]), input)).toBeNull();
    expect(await runRefine(ctx([generatingModel("[1,2]")]), input)).toBeNull();
    expect(await runRefine(ctx([generatingModel("null")]), input)).toBeNull();
    expect(await runRefine(ctx([generatingModel('[{"reply":"x"}]')]), input)).toBeNull();
    expect(await runRefine(ctx([brokenGenerateModel()]), input)).toBeNull();
    const onFail = vi.fn();
    expect(await runRefine({ ...ctx([brokenGenerateModel()]), onFail }, input)).toBeNull();
    expect(onFail).toHaveBeenCalledWith("m0");
  });

  it("vision answers from the first model that sees something", async () => {
    const good = generatingModel(
      JSON.stringify({ kind: "venue", palette: [{ name: "Teal", hex: "#007777" }] }),
    );
    const result = await runVision(ctx([brokenGenerateModel(), good]), {
      facts: weddingFacts,
      locale: "en",
      today: TODAY,
      image: JPEG,
      mediaType: "image/jpeg",
    });
    expect(result).toMatchObject({ kind: "venue", model: "m1" });
  });

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
