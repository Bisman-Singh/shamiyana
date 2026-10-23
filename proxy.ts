import { NextResponse, type NextRequest } from "next/server";

/**
 * A fresh nonce and Content-Security-Policy per page request. With a nonce
 * the policy needs no `'unsafe-inline'` for scripts or styles: only the
 * scripts Next.js emits for this response can run, and the app uses no inline
 * style attributes, since bars and swatches are SVG attributes.
 * `connect-src 'self'` means the browser only ever talks to this server;
 * Gemini is reached from the server side.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const styles = isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${styles}`,
    "img-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Sets a fresh nonce and the CSP on every page request. */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static/|_next/image|favicon\\.ico$|icon\\.svg$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
