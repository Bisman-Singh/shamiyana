import "server-only";
import { runVision } from "@/lib/ai/vision";
import type { AiDeps } from "./deps";
import { guard, parseJson } from "./http";
import { visionFieldsSchema } from "@/lib/api/contracts";
import { IMAGE_MAX_BYTES, sniffImage } from "./images";
import {
  admit,
  aiRoute,
  answered,
  BODY_LIMITS,
  type Checked,
  type RouteHandler,
  type RouteLog,
} from "./route-kit";

async function readForm(bytes: Uint8Array, contentType: string): Promise<FormData | null> {
  try {
    return await new Response(bytes as BodyInit, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    return null;
  }
}

type Upload = Checked<{ image: Uint8Array; mediaType: string; fields: unknown }>;

/** The guarded multipart body: one image whose bytes are a real JPEG, PNG or WebP, plus a small JSON part. */
async function readUpload(request: Request, deps: AiDeps): Promise<Upload> {
  const guarded = await guard(request, {
    limiter: deps.limiters.vision,
    maxBytes: IMAGE_MAX_BYTES + BODY_LIMITS.visionFields,
    type: "multipart/form-data",
  });
  if (!guarded.ok) return guarded;
  const form = await readForm(guarded.bytes, guarded.contentType);
  const image = form?.get("image");
  const fields = form?.get("fields");
  if (!(image instanceof File) || typeof fields !== "string") {
    return { ok: false, code: "bad_request" };
  }
  if (image.size > IMAGE_MAX_BYTES || fields.length > BODY_LIMITS.visionFields) {
    return { ok: false, code: "too_large" };
  }
  const parsedFields = parseJson(new TextEncoder().encode(fields));
  if (parsedFields === undefined) return { ok: false, code: "bad_request" };
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mediaType = sniffImage(bytes);
  if (!mediaType) return { ok: false, code: "unsupported_media_type" };
  return { ok: true, data: { image: bytes, mediaType, fields: parsedFields } };
}

/** The upload is checked before the allowance is taken, so a file that is refused costs nothing. */
async function handleVision(request: Request, deps: AiDeps, log: RouteLog): Promise<Response> {
  const upload = await readUpload(request, deps);
  if (!upload.ok) return log.fail(upload.code, upload.headers);
  const parsed = visionFieldsSchema(deps.now()).safeParse(upload.data.fields);
  if (!parsed.success) return log.fail("invalid");
  const gate = await admit(request, deps, log);
  if ("refused" in gate) return log.fail(gate.refused);
  const { image, mediaType } = upload.data;
  return answered(log, await runVision(gate.ctx, { ...parsed.data, image, mediaType }));
}

/** POST /api/vision: checks the upload's real type and size, then returns ideas from the photo. */
export function visionHandler(getDeps: () => AiDeps): RouteHandler {
  return aiRoute("vision", getDeps, handleVision);
}
