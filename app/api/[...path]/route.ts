import { errorResponse } from "@/lib/server/http";

/** An API path that doesn't exist answers a bare JSON 404, like every other API error. */
function notFound(): Response {
  return errorResponse("not_found");
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
