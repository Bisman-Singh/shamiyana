import { liveDeps } from "@/lib/server/deps";
import { planHandler } from "@/lib/server/plan-handler";

export const maxDuration = 60;

export const POST = planHandler(liveDeps);
