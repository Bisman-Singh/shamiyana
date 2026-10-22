/**
 * Reads a byte stream to the end, or stops and cancels it once it passes
 * `max` bytes, so an oversized upload or a decompression bomb never sits
 * whole in memory. Used by the request guard and the share link decoder.
 */
export async function readAtMost(
  stream: ReadableStream<Uint8Array>,
  max: number,
): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
