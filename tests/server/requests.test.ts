import { planRequestSchema, sniffImage } from "@/lib/server/requests";
import { TODAY, weddingFacts } from "../helpers/fixtures";
import { FIXED_NOW, JPEG, PNG, WEBP } from "../helpers/ai";

describe("request schemas", () => {
  it("accepts a device date a day either side of the server", () => {
    const schema = planRequestSchema(FIXED_NOW);
    for (const today of ["2026-10-20", TODAY, "2026-10-22"]) {
      expect(schema.safeParse({ facts: weddingFacts, locale: "en", today }).success).toBe(true);
    }
    expect(schema.parse({ facts: weddingFacts, locale: "hi", today: TODAY }).fresh).toBe(false);
  });
});

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
