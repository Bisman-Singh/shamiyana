import { healthHandler } from "@/lib/server/health-handler";

/** Answered on every request, never prerendered at build time. */
export const dynamic = "force-dynamic";

/** GET /api/health: up or not, and nothing about how the server is configured. */
export const GET = healthHandler;
