import { liveDeps } from "@/lib/server/deps";
import { refineHandler } from "@/lib/server/refine-handler";

export const maxDuration = 60;

export const POST = refineHandler(liveDeps);
