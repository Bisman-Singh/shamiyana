import { healthHandler, liveDeps } from "@/lib/server/handlers";

export const dynamic = "force-dynamic";

export const GET = healthHandler(liveDeps);
