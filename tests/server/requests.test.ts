import { sniffImage } from "@/lib/server/requests";
import { JPEG, PNG, WEBP } from "../helpers/ai";

describe("sniffImage", () => {
  it("recognises JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(WEBP)).toBe("image/webp");
  });

  it.each([
    ["SVG", new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")],
    ["GIF", new TextEncoder().encode("GIF89a......")],
    ["RIFF that is not WebP", new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WAVEfmt ")],
    ["a short RIFF", new TextEncoder().encode("RIFF")],
    ["nothing", new Uint8Array()],
  ])("rejects %s", (_label, bytes) => {
    expect(sniffImage(bytes)).toBeNull();
  });
});
