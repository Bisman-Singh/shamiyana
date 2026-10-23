import { DailyCap } from "@/lib/server/rate-limit";
import { visionHandler } from "@/lib/server/vision-handler";
import { JPEG, formPost, generatingModel, jsonPost, spec, testDeps } from "../helpers/ai";
import { TODAY, weddingFacts } from "../helpers/fixtures";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/vision", () => {
  const fields = JSON.stringify({ facts: weddingFacts, locale: "hi", today: TODAY });
  const vision = JSON.stringify({
    kind: "decor",
    mood: "Warm and festive",
    palette: [
      { name: "Marigold", hex: "#F39B2D" },
      { name: "Bad", hex: "orange" },
    ],
    ideas: [{ area: "decor", title: "Genda phool torans", detail: "At every doorway." }],
    notes: ["Low ceiling"],
  });

  function form(image: Uint8Array | string | null, extra?: string) {
    const data = new FormData();
    if (image instanceof Uint8Array) {
      data.set("image", new File([image as BlobPart], "x.jpg", { type: "image/png" }));
    } else if (image !== null) {
      data.set("image", image);
    }
    data.set("fields", extra ?? fields);
    return data;
  }

  it("sniffs the real type, sends the image and returns sanitized insights", async () => {
    const model = generatingModel(vision);
    const response = await visionHandler(() => testDeps([spec(model)]))(formPost(form(JPEG)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "decor",
      mood: "Warm and festive",
      palette: [{ name: "Marigold", hex: "#f39b2d" }],
      ideas: [{ area: "decor", title: "Genda phool torans", detail: "At every doorway." }],
      notes: ["Low ceiling"],
    });
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("image/jpeg");
    expect(prompt).toContain("Hindi in Devanagari script");
  });

  it.each([
    [
      "a file that is not an image",
      form(new TextEncoder().encode("<svg onload=alert(1)>")),
      "unsupported_media_type",
    ],
    ["a text field instead of a file", form("not a file"), "bad_request"],
    ["no image", form(null), "bad_request"],
    ["invalid fields", form(JPEG, "{}"), "invalid"],
    ["fields that are not JSON", form(JPEG, "{oops"), "bad_request"],
    ["fields over 16 KB", form(JPEG, JSON.stringify({ pad: "x".repeat(17_000) })), "too_large"],
  ])("rejects %s", async (_label, data, code) => {
    const response = await visionHandler(() => testDeps([spec(generatingModel(vision))]))(
      formPost(data),
    );
    expect(await response.json()).toEqual({ error: code });
  });

  it("rejects a JSON body and a broken multipart body", async () => {
    const deps = testDeps([spec(generatingModel(vision))]);
    expect((await visionHandler(() => deps)(jsonPost({}))).status).toBe(415);
    const broken = await visionHandler(() => deps)(
      jsonPost("garbage", { "content-type": "multipart/form-data; boundary=zzz" }),
    );
    expect(await broken.json()).toEqual({ error: "bad_request" });
  });

  it("rejects an oversized image", async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(JPEG);
    const response = await visionHandler(() => testDeps([spec(generatingModel(vision))]))(
      formPost(form(big)),
    );
    expect(response.status).toBe(413);
  });

  it("fails cleanly without a key, past the cap, or with an empty answer", async () => {
    expect(await (await visionHandler(() => testDeps(null))(formPost(form(JPEG)))).json()).toEqual({
      error: "ai_unavailable",
    });
    const capped = testDeps([spec(generatingModel(vision))], { daily: new DailyCap({ cap: 0 }) });
    expect(await (await visionHandler(() => capped)(formPost(form(JPEG)))).json()).toEqual({
      error: "daily_cap",
    });
    const empty = testDeps([spec(generatingModel('{"kind":"other","ideas":[],"palette":[]}'))]);
    expect(await (await visionHandler(() => empty)(formPost(form(JPEG)))).json()).toEqual({
      error: "ai_failed",
    });
  });

  it("refuses a cross-site upload", async () => {
    const response = await visionHandler(() => testDeps(null))(
      formPost(form(JPEG), { "sec-fetch-site": "cross-site" }),
    );
    expect(response.status).toBe(403);
  });
});
