import { liveDeps, planHandler } from "@/lib/server/handlers";

export const maxDuration = 60;

export const POST = planHandler(liveDeps);
