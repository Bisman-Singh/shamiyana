import { liveDeps, refineHandler } from "@/lib/server/handlers";

export const maxDuration = 60;

export const POST = refineHandler(liveDeps);
