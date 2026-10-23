import { liveDeps } from "@/lib/server/deps";
import { visionHandler } from "@/lib/server/vision-handler";

/** Seconds Vercel lets this route run; the model chain gets 55 of them. */
export const maxDuration = 60;

/**
 * POST /api/vision
 *
 * 1. Same origin, multipart, the per-minute limit and the body cap.
 * 2. One image whose bytes are a real JPEG, PNG or WebP, plus the facts
 *    against their strict schema.
 * 3. The AI must be on and today's allowance must have room.
 * 4. The first model that sees something answers, sanitized, as JSON.
 *
 * Each outcome is one log line; anything unexpected is a bare 500.
 */
export const POST = visionHandler(liveDeps);
