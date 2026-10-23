import { liveDeps } from "@/lib/server/deps";
import { refineHandler } from "@/lib/server/refine-handler";

/** Seconds Vercel lets this route run; the model chain gets 55 of them. */
export const maxDuration = 60;

/**
 * POST /api/refine
 *
 * 1. Same origin, JSON, the per-minute limit and the body cap.
 * 2. The facts, weights, recent turns and message against their strict schema.
 * 3. A message that tries to re-instruct the assistant gets a fixed reply,
 *    with no model call.
 * 4. Otherwise the AI must be on and today's allowance must have room.
 * 5. The first usable reply comes back as JSON with the changes that pass
 *    validation.
 *
 * Each outcome is one log line; anything unexpected is a bare 500.
 */
export const POST = refineHandler(liveDeps);
