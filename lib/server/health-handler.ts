import "server-only";
import { JSON_HEADERS } from "./route-kit";

/** Up or not, and nothing else: whether AI is configured stays private. */
export function healthHandler(): Response {
  return Response.json({ status: "ok" }, { headers: JSON_HEADERS });
}
