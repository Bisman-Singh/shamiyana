/**
 * Browser pieces jsdom lacks. Everything here is a spy or a stubbed global,
 * so `vi.restoreAllMocks()` and `vi.unstubAllGlobals()` undo it.
 */

export function stubObjectUrls(url = "blob:test") {
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue(url);
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  return { create, revoke };
}

interface CanvasStub {
  width?: number;
  height?: number;
  /** What `toBlob` hands back; null is an encoder failure. */
  blob?: Blob | null;
}

/** A decoder that reports the given size and a canvas that encodes to `blob`. */
export function stubCanvas({
  width = 10,
  height = 10,
  blob = new Blob(["j"], { type: "image/jpeg" }),
}: CanvasStub = {}) {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve({ width, height, close })),
  );
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw,
  } as never);
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => {
    done(blob);
  });
  return { close, draw, toBlob };
}
