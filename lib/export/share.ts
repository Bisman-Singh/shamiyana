import { z } from "zod";
import { createRecord } from "@/lib/plan/record";
import { planRecordSchema, type PlanRecord } from "@/lib/plan/schema";

/**
 * Share links carry the plan in the URL fragment, deflated and base64url
 * encoded. A fragment never reaches any server, so sharing needs no account
 * and no storage. The guest list and vendor notes are left out: they are about
 * other people and stay on the device they were typed on.
 */

export const SHARE_KEY = "plan";
const MAX_ENCODED = 32_000;
const MAX_JSON = 128_000;

const sharedSchema = z.strictObject({
  v: z.literal(1),
  plan: planRecordSchema.pick({
    brief: true,
    enrichment: true,
    enrichedFor: true,
    factors: true,
    tasks: true,
    hidden: true,
    done: true,
    vendors: true,
    ideas: true,
  }),
});
export type SharedPlan = z.infer<typeof sharedSchema>["plan"];

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Feeds bytes into a compression or decompression stream and returns its output. Write
 * errors surface on the read side, where the caller handles them.
 */
function through(stream: CompressionStream | DecompressionStream, bytes: Uint8Array) {
  const writer = stream.writable.getWriter();
  void Promise.allSettled([writer.write(bytes as BufferSource), writer.close()]);
  return stream.readable;
}

/** Inflates at most `max` bytes; a bomb that would expand further is cut off and rejected. */
async function inflate(bytes: Uint8Array, max: number): Promise<Uint8Array | null> {
  const reader = through(new DecompressionStream("deflate-raw"), bytes).getReader();
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

export async function encodeShare(record: PlanRecord): Promise<string> {
  const vendors = Object.fromEntries(
    Object.entries(record.vendors).map(([category, progress]) => [
      category,
      { ...progress, note: "" },
    ]),
  );
  const payload: z.infer<typeof sharedSchema> = {
    v: 1,
    plan: {
      brief: record.brief,
      enrichment: record.enrichment,
      enrichedFor: record.enrichedFor,
      factors: record.factors,
      tasks: record.tasks,
      hidden: record.hidden,
      done: record.done,
      vendors,
      ideas: record.ideas,
    },
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const packed = await new Response(
    through(new CompressionStream("deflate-raw"), json),
  ).arrayBuffer();
  return toBase64Url(new Uint8Array(packed));
}

/** The shared plan in a fragment value, or null for anything malformed, oversized or invalid. */
export async function decodeShare(encoded: string): Promise<SharedPlan | null> {
  if (encoded.length === 0 || encoded.length > MAX_ENCODED) return null;
  try {
    const bytes = fromBase64Url(encoded);
    if (!bytes) return null;
    const json = await inflate(bytes, MAX_JSON);
    if (!json) return null;
    const parsed = sharedSchema.safeParse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json)),
    );
    return parsed.success ? parsed.data.plan : null;
  } catch {
    return null;
  }
}

export function recordFromShare(shared: SharedPlan, id: string, now: string): PlanRecord {
  return { ...createRecord(shared.brief, id, now), ...shared, guests: [] };
}

export function shareUrl(origin: string, encoded: string): string {
  return `${origin}/#${SHARE_KEY}=${encoded}`;
}

/** The encoded plan from a location hash like `#plan=...`, if there is one. */
export function readShareHash(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.get(SHARE_KEY);
}
