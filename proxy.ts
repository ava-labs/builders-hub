import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { matchRoute } from "@/lib/auth/routeManifest";
import { actionFromMethod } from "@/lib/auth/rolePermissions";
import { hasPermission } from "@/lib/auth/roles";

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
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
    return rewriteResponse;
  }

  if (isContentPath && !isProtectedAcademyPath) {
    const contentResponse = NextResponse.next();
    contentResponse.headers.set("Vary", "Accept");
    return contentResponse;
  }

  // ── Route manifest check ──────────────────────────────────────────────────
  const matched = matchRoute(pathname);

  // Public route — pass through
  if (!matched) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;
  const isApi = pathname.startsWith("/api/");

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // For UI routes: set header so AutoLoginModalTrigger can detect it
    const blockedResponse = NextResponse.next();
    blockedResponse.headers.set("x-auth-required", "true");
    return blockedResponse;
  }

  // ── Authenticated on login page → redirect home ───────────────────────────
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ── authOnly route — any session is enough ────────────────────────────────
  if (matched.authOnly) return NextResponse.next();

  // ── Permission check ──────────────────────────────────────────────────────
  const action = actionFromMethod(req.method);
  const attrs = (token.custom_attributes as string[]) ?? [];

  if (!hasPermission(attrs, { resource: matched.resource!, action })) {
    if (isApi) {
      return NextResponse.json(
        { error: "Forbidden", required: `${matched.resource}:${action}` },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
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
