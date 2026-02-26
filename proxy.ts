import { getToken } from "next-auth/jwt";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { NextMiddlewareResult } from "next/dist/server/web/types";
import { NextRequest, NextResponse } from "next/server";

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

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;
  const isLoginPage = pathname === "/login";
  const isShowCase = pathname.startsWith("/showcase");
  const isSendNotifications = pathname.startsWith("/send-notifications");
  const custom_attributes = token?.custom_attributes as string[] ?? []

  const protectedPaths = [
    "/hackathons/registration-form",
    "/hackathons/project-submission",
    "/showcase",
    "/send-notifications",
    "/profile",
    "/student-launchpad",
    "/grants/"
  ];

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Protect routes: block unauthenticated access to protected paths without redirecting
  // The client-side component (AutoLoginModalTrigger) will detect this and show the login modal
  if (!isAuthenticated && !isLoginPage && isProtectedPath) {
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
      return NextResponse.redirect(new URL("/hackathons", req.url))

    if (isSendNotifications && !(custom_attributes.includes('devrel') || custom_attributes.includes('notify_event')))
      return NextResponse.redirect(new URL("/", req.url))

    // Protect hackathons/edit route - only team1-admin and hackathonCreator can access
    if (pathname.startsWith("/hackathons/edit")) {
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
    "/hackathons/registration-form/:path*",
    "/hackathons/project-submission/:path*",
    "/hackathons/edit/:path*",
    "/showcase/:path*",
    "/send-notifications/:path*",
    "/login/:path*",
    "/profile/:path*",
    "/academy/:path*/get-certificate",
    "/academy/:path*/certificate",
    "/console/utilities/data-api-keys",
    "/grants/:path+",
  ],
};
