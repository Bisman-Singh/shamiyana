// @vitest-environment jsdom
import { ImageEncodeError, UnsupportedImageError, prepareImage } from "@/lib/client/image";
import { stubCanvas } from "@/tests/helpers/browser";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("prepareImage", () => {
  it("scales a large photo down to 1600px and re-encodes it as JPEG", async () => {
    const { close, toBlob } = stubCanvas({ width: 4000, height: 3000 });
    let size: [number, number] = [0, 0];
    toBlob.mockImplementation(function (this: HTMLCanvasElement, done, type) {
      size = [this.width, this.height];
      done(new Blob(["x"], { type: type ?? "" }));
    });
    const blob = await prepareImage(new File(["p"], "a.webp", { type: "image/webp" }));
    expect(blob.type).toBe("image/jpeg");
    expect(size).toEqual([1600, 1200]);
    expect(close).toHaveBeenCalled();
  });

  it("refuses non-images and fails cleanly without a canvas", async () => {
    await expect(prepareImage(new File(["p"], "a.svg", { type: "image/svg+xml" }))).rejects.toThrow(
      UnsupportedImageError,
    );
    stubCanvas();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(prepareImage(new File(["p"], "a.png", { type: "image/png" }))).rejects.toThrow(
      new ImageEncodeError("canvas"),
    );
  });
});
