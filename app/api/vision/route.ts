import { liveDeps } from "@/lib/server/deps";
import { visionHandler } from "@/lib/server/vision-handler";

export const maxDuration = 60;

export const POST = visionHandler(liveDeps);
