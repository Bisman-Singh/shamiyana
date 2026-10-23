import { AnswerCache } from "@/lib/ai/cache";
import { lookupPlan, streamPlan, type PlanInput } from "@/lib/ai/plan-stream";
import { cutOffModel, spec, streamingModel } from "../helpers/ai";
import { TODAY, weddingFacts } from "../helpers/fixtures";

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
