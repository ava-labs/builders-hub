import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { matchRoute } from "@/lib/auth/routeManifest";
import { actionFromMethod } from "@/lib/auth/rolePermissions";
import { hasPermission } from "@/lib/auth/roles";

function appendVary(response: Response, value: string): void {
  const current = response.headers.get("Vary");
  if (!current) {
    response.headers.set("Vary", value);
    return;
  }
  const values = current.split(",").map((part) => part.trim());
  if (!values.includes(value)) {
    response.headers.set("Vary", `${current}, ${value}`);
  }
}

function applyCorsHeaders(response: Response, requestOrigin: string | null): Response {
  const allowedOrigin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (requestOrigin === allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    appendVary(response, "Origin");
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  return response;
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const requestOrigin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return applyCorsHeaders(new Response(null, { status: 204 }), requestOrigin);
  }

  // ── Content negotiation: serve markdown when Accept: text/markdown ────────
  const contentPrefixes = ["/docs/", "/academy/", "/blog/", "/integrations/"];
  const isContentPath = contentPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const acceptHeader = req.headers.get("accept") || "";
  const wantsMarkdown = acceptHeader.includes("text/markdown");

  // Protected academy sub-paths must NOT skip auth
  const protectedAcademySuffixes = ["/get-certificate", "/certificate"];
  const isProtectedAcademyPath =
    pathname.startsWith("/academy/") &&
    protectedAcademySuffixes.some((suffix) => pathname.endsWith(suffix));

  if (wantsMarkdown && isContentPath && !isProtectedAcademyPath) {
    const apiUrl = new URL(`/api/raw${pathname}`, req.url);
    const rewriteResponse = NextResponse.rewrite(apiUrl);
    rewriteResponse.headers.set("Vary", "Accept");
    return applyCorsHeaders(rewriteResponse, requestOrigin);
  }

  if (isContentPath && !isProtectedAcademyPath) {
    const contentResponse = NextResponse.next();
    contentResponse.headers.set("Vary", "Accept");
    return applyCorsHeaders(contentResponse, requestOrigin);
  }

  // ── Route manifest check ──────────────────────────────────────────────────
  const matched = matchRoute(pathname);

  // Public route — pass through
  if (!matched) return applyCorsHeaders(NextResponse.next(), requestOrigin);

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;
  const isApi = pathname.startsWith("/api/");

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (isApi) {
      return applyCorsHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), requestOrigin);
    }
    // For UI routes: set header so AutoLoginModalTrigger can detect it
    const blockedResponse = NextResponse.next();
    blockedResponse.headers.set("x-auth-required", "true");
    return applyCorsHeaders(blockedResponse, requestOrigin);
  }

  // ── Authenticated on login page → redirect home ───────────────────────────
  if (pathname === "/login") {
    return applyCorsHeaders(NextResponse.redirect(new URL("/", req.url)), requestOrigin);
  }

  // ── authOnly route — any session is enough ────────────────────────────────
  if (matched.authOnly) return applyCorsHeaders(NextResponse.next(), requestOrigin);

  // ── Permission check ──────────────────────────────────────────────────────
  const action = matched.action ?? actionFromMethod(req.method);
  const attrs = (token.custom_attributes as string[]) ?? [];

  if (!hasPermission(attrs, { resource: matched.resource!, action })) {
    if (isApi) {
      return applyCorsHeaders(NextResponse.json(
        { error: "Forbidden", required: `${matched.resource}:${action}` },
        { status: 403 }
      ), requestOrigin);
    }
    return applyCorsHeaders(NextResponse.redirect(new URL("/", req.url)), requestOrigin);
  }

  return applyCorsHeaders(NextResponse.next(), requestOrigin);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static  (static assets)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - Files with an extension (e.g. .png, .js)
     *
     * Content paths (/docs, /academy, /blog, /integrations) are included so
     * markdown content-negotiation can run before auth checks.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
