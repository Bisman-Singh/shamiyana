// @vitest-environment jsdom
import {
  UnsupportedImageError,
  downloadText,
  prepareImage,
  readTextFile,
} from "@/lib/client/files";
import { stubCanvas, stubObjectUrls } from "../helpers/browser";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("files", () => {
  it("downloads text through a temporary link", () => {
    const { revoke } = stubObjectUrls("blob:file");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    downloadText("plan.csv", "text/csv", "a,b");
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:file");
    expect(document.querySelector("a[download]")).toBeNull();
  });

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
      "canvas",
    );
  });

  it("reads small text files only", async () => {
    expect(await readTextFile(new File(["hello"], "a.json"), 10)).toBe("hello");
    expect(await readTextFile(new File(["hello world"], "a.json"), 5)).toBeNull();
  });
});
