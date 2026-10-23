import { liveDeps } from "@/lib/server/deps";
import { planHandler } from "@/lib/server/plan-handler";

/** Seconds Vercel lets this route run; the model chain gets 55 of them. */
export const maxDuration = 60;

/**
 * POST /api/plan
 *
 * 1. Same origin, JSON, the per-minute limit and the body cap.
 * 2. The brief against its strict schema.
 * 3. A recent answer for the same brief comes from the cache, unless fresh
 *    ideas are asked for.
 * 4. Otherwise the AI must be on and today's allowance must have room.
 * 5. Ideas stream from the first model that starts answering, and the answer
 *    is cached once it is complete and usable.
 *
 * Each outcome is one log line; anything unexpected is a bare 500.
 */
export const POST = planHandler(liveDeps);
