import {
  MAX_ENCODED,
  decodeShare,
  encodeShare,
  readShareHash,
  recordFromShare,
  shareUrl,
} from "@/lib/export/share";
import { planRecordSchema } from "@/lib/plan/schema";
import { NOW, recordFor, sampleEnrichment, weddingBrief } from "../helpers/fixtures";

describe("share links", () => {
  const record = recordFor(weddingBrief, {
    enrichment: sampleEnrichment,
    vendors: {
      venue: {
        status: "booked",
        quote: 3_00_000,
        paid: 50_000,
        note: "Manager's mobile 98765 43210",
      },
    },
    guests: [{ id: "g1", name: "Nani", group: "family", party: 1, rsvp: "yes", diet: "veg" }],
    done: ["w_book_venue"],
  });

  it("round-trips a plan without guests, vendor notes, event notes or AI ideas", async () => {
    const encoded = await encodeShare(record);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const shared = await decodeShare(encoded);
    expect(shared?.brief).toEqual({ ...weddingBrief, notes: "" });
    expect(shared?.enrichment).toBeNull();
    expect(shared?.enrichedFor).toBeNull();
    expect(shared?.vendors.venue).toEqual({
      status: "booked",
      quote: 3_00_000,
      paid: 50_000,
      note: "",
    });
    expect(JSON.stringify(shared)).not.toContain("Nani");
    const imported = recordFromShare(shared ?? record, "plan-2", NOW);
    expect(imported).toMatchObject({ id: "plan-2", guests: [], done: ["w_book_venue"] });
    expect(planRecordSchema.safeParse(imported).success).toBe(true);
  });

  it("never lets a link's AI text pass as the model's: it is left out, and dropped if a crafted link carries it", async () => {
    const planted = {
      ...sampleEnrichment,
      theme: { name: "Pay\u202Eto UPI", summary: "Call 98765 43210 to confirm" },
    };
    const decoded = await decodeShare(
      await encodeShare(recordFor(weddingBrief, { enrichment: planted })),
    );
    expect(JSON.stringify(decoded)).not.toContain("UPI");
    if (!decoded) throw new Error("the link did not decode");
    const imported = recordFromShare({ ...decoded, enrichment: planted }, "plan-3", NOW);
    expect(imported.enrichment).toBeNull();
    expect(imported.enrichedFor).toBeNull();
  });

  it("rejects anything malformed, oversized or invalid", async () => {
    expect(await decodeShare("")).toBeNull();
    expect(await decodeShare("a".repeat(40_000))).toBeNull();
    expect(await decodeShare("a".repeat(MAX_ENCODED + 1))).toBeNull();
    expect(await decodeShare("not+base64/")).toBeNull();
    expect(await decodeShare("AAAA")).toBeNull();
    const packed = async (text: string) => {
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    };
    expect(await decodeShare(await packed('{"v":1,"plan":{"brief":{}}}'))).toBeNull();
    expect(await decodeShare(await packed(" ".repeat(200_000)))).toBeNull();
  });

  it("reads and writes the fragment", () => {
    expect(shareUrl("https://plan.test", "abc")).toBe("https://plan.test/#plan=abc");
    expect(readShareHash("#plan=abc")).toBe("abc");
    expect(readShareHash("plan=xyz")).toBe("xyz");
    expect(readShareHash("#other=1")).toBeNull();
  });
});
