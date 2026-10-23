import { readAtMost } from "@/lib/shared/byte-stream";

const stream = (...chunks: number[][]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    },
  });

describe("readAtMost", () => {
  it("joins the chunks of a stream within the limit", async () => {
    expect(await readAtMost(stream([1, 2], [3]), 3)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("stops and gives nothing once the stream passes the limit", async () => {
    expect(await readAtMost(stream([1, 2], [3, 4]), 3)).toBeNull();
  });
});
