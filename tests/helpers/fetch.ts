import type { Mock } from "vitest";

type Handler = (body: unknown, init: RequestInit) => Response | Promise<Response>;

function urlOf(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  return input instanceof URL ? input.href : input;
}

/** Routes fetch calls by path to handlers, recording each JSON body sent. */
export function mockFetch(
  routes: Record<string, Handler>,
): Mock & { bodies: Record<string, unknown[]> } {
  const bodies: Record<string, unknown[]> = {};
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(urlOf(input), "https://plan.test").pathname;
    const handler = routes[path];
    if (!handler) throw new TypeError(`unexpected fetch ${path}`);
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    const sent = bodies[path] ?? [];
    sent.push(body);
    bodies[path] = sent;
    return await handler(body, init);
  });
  vi.stubGlobal("fetch", fn);
  return Object.assign(fn, { bodies });
}

/** A text response that arrives in pieces, like a model stream. */
export function streamed(pieces: readonly string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const piece of pieces) controller.enqueue(encoder.encode(piece));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

export function jsonError(code: string, status: number): Response {
  return Response.json({ error: code }, { status });
}
