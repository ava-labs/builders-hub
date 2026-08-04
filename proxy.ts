import { getToken } from "next-auth/jwt";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { NextMiddlewareResult } from "next/dist/server/web/types";
import { NextRequest, NextResponse } from "next/server";
import { hasTeam1AcademyAccess } from "@/lib/auth/roles";
import { PROTECTED_PATHS } from "@/lib/auth/protected-paths";

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

  // Team1 raw markdown API: the only branch we can't express through the
  // canonical machinery below — it's an API (so it needs JSON responses
  // instead of redirects/headers) and there is no client-side modal trigger
  // in scope. Everything else for Team1 (HTML pages, markdown negotiation)
  // is handled by adding /academy/team1 to PROTECTED_PATHS + the
  // authenticated branch below.
  if (pathname.startsWith('/api/raw/academy/team1')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const attrs = (token.custom_attributes as string[]) ?? [];
    if (!hasTeam1AcademyAccess(attrs)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Access OK: fall through to the normal flow.
  }

  // Content negotiation: serve markdown when Accept: text/markdown is requested
  const contentPrefixes = ['/docs/', '/academy/', '/blog/', '/integrations/'];
  const isContentPath = contentPrefixes.some(prefix => pathname.startsWith(prefix));
  const acceptHeader = req.headers.get('accept') || '';
  const wantsMarkdown = acceptHeader.includes('text/markdown');

  // Paths that must not take the markdown bypass shortcut. They flow into
  // the canonical auth machinery instead. We include /academy/team1 here so
  // that an anonymous `curl -H "Accept: text/markdown" /academy/team1/...`
  // does NOT get rewritten to /api/raw/...; it falls through and hits the
  // protected-paths block which returns x-auth-required.
  const protectedAcademySuffixes = ['/get-certificate', '/certificate'];
  const isProtectedAcademyPath =
    pathname.startsWith('/academy/team1') ||
    (pathname.startsWith('/academy/') &&
      protectedAcademySuffixes.some(suffix => pathname.endsWith(suffix)));

  if (wantsMarkdown && isContentPath && !isProtectedAcademyPath) {
    const apiUrl = new URL(`/api/raw${pathname}`, req.url);
    const rewriteResponse = NextResponse.rewrite(apiUrl);
    rewriteResponse.headers.set('Vary', 'Accept');
    return rewriteResponse;
  }

  // For content paths without markdown request, add Vary header and pass through
  if (isContentPath && !isProtectedAcademyPath) {
    const contentResponse = NextResponse.next();
    contentResponse.headers.set('Vary', 'Accept');
    return contentResponse;
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;
  const isLoginPage = pathname === "/login";
  const isShowCase = pathname.startsWith("/showcase");
  const isSendNotifications = pathname.startsWith("/send-notifications");
  const custom_attributes = token?.custom_attributes as string[] ?? []

  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path));

  // Protect routes: block unauthenticated access to protected paths without redirecting
  // The client-side component (AutoLoginModalTrigger) will detect this and show the login modal
  if (!isAuthenticated && !isLoginPage && isProtectedPath) {
    // If it's /events/edit, redirect to home
    if (pathname.startsWith("/hackathons/edit") || pathname.startsWith("/events/edit")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    // Block access by setting a header, but allow the request to continue
    // The page will render but the client will show the login modal
    const blockedResponse = NextResponse.next();
    blockedResponse.headers.set("x-auth-required", "true");
    return blockedResponse;
  }

  if (isAuthenticated) {
    if (isLoginPage)
      return NextResponse.redirect(new URL("/", req.url));

    if (isShowCase && !custom_attributes.includes('showcase'))
      return NextResponse.redirect(new URL("/events", req.url))

    if (isSendNotifications && !(custom_attributes.includes('devrel') || custom_attributes.includes('notify_event')))
      return NextResponse.redirect(new URL("/", req.url))

    if (pathname.startsWith("/academy/team1") && !hasTeam1AcademyAccess(custom_attributes))
      return NextResponse.redirect(new URL("/", req.url))

    // Protect hackathons/edit and events/edit routes - only team1-admin and hackathonCreator can access
    if (pathname.startsWith("/hackathons/edit") || pathname.startsWith("/events/edit")) {
      const hasRequiredPermissions = custom_attributes.includes("team1-admin") ||
                                   custom_attributes.includes("hackathonCreator")  ||
                                   custom_attributes.includes("devrel");
      if (!hasRequiredPermissions) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    // For authenticated users on protected paths, use withAuth to ensure protection
    if (isProtectedPath) {
      return withAuth(
        (authReq: NextRequestWithAuth): NextMiddlewareResult => {
          return NextResponse.next();
        },
        {
          pages: {
            signIn: "/login",
          },
          callbacks: {
            authorized: ({ token }) => !!token,
          }
        }
      )(req as NextRequestWithAuth, {} as any);
    }
  }

  // For non-protected paths or unauthenticated users on non-protected paths, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Auth-protected paths
    "/hackathons/registration-form/:path*",
    "/hackathons/project-submission/:path*",
    "/hackathons/edit/:path*",
    "/events/registration-form/:path*",
    "/events/project-submission/:path*",
    "/events/edit/:path*",
    "/showcase/:path*",
    "/send-notifications/:path*",
    "/login/:path*",
    "/profile/:path*",
    "/academy/:path*/get-certificate",
    "/academy/:path*/certificate",
    "/console/utilities/data-api-keys",
    "/grants/:path+",
    // Content paths for Accept: text/markdown negotiation
    "/docs/:path*",
    "/academy/:path*",
    "/blog/:path*",
    "/integrations/:path*",
    // Team1 raw markdown API
    "/api/raw/academy/team1/:path*",
  ],
};
