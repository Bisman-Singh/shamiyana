import { simulateReadableStream } from "ai";
import { firstSuccess, firstWorking } from "@/lib/ai/fallback";

describe("fallback", () => {
  const parts =
    (...values: string[]) =>
    () =>
      simulateReadableStream({ chunks: values });
  const probe = {
    isContent: (p: string) => p.startsWith("text"),
    isError: (p: string) => p === "error",
  };

  async function drain(stream: ReadableStream<string>) {
    const out: string[] = [];
    for await (const part of stream) out.push(part);
    return out;
  }

  it("replays the first working stream from its start", async () => {
    const failed: string[] = [];
    const opened = await firstWorking(
      [
        { id: "a", run: parts("start", "error") },
        { id: "b", run: parts("start") },
        {
          id: "c",
          run: () => {
            throw new Error("sync");
          },
        },
        { id: "d", run: parts("start", "text1", "text2") },
      ],
      probe,
      (id) => failed.push(id),
    );
    expect(opened?.id).toBe("d");
    expect(failed).toEqual(["a", "b", "c"]);
    expect(await drain(opened?.stream ?? new ReadableStream())).toEqual([
      "start",
      "text1",
      "text2",
    ]);
  });

  it("returns null when nothing works, and can be cancelled midway", async () => {
    expect(await firstWorking([{ id: "a", run: parts("error") }], probe)).toBeNull();
    const opened = await firstWorking([{ id: "a", run: parts("text1", "text2") }], probe);
    await opened?.stream.cancel("stop");
  });

  it("tries async attempts in order", async () => {
    const failed: string[] = [];
    const result = await firstSuccess(
      [
        { id: "a", run: () => Promise.reject(new Error("x")) },
        { id: "b", run: () => Promise.resolve("ok") },
      ],
      (id) => failed.push(id),
    );
    expect(result).toEqual({ id: "b", value: "ok" });
    expect(failed).toEqual(["a"]);
    expect(await firstSuccess([{ id: "a", run: () => Promise.reject(new Error("y")) }])).toBeNull();
  });
});
