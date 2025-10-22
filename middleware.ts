import { getToken } from "next-auth/jwt";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { NextMiddlewareResult } from "next/dist/server/web/types";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Proxy Mintlify-powered API Reference through our domain in production
  if (pathname === '/docs/api-reference' || pathname.startsWith('/docs/api-reference/')) {
    const suffix = pathname === '/docs/api-reference' ? '' : pathname.replace('/docs/api-reference', '');
    const target = new URL(`https://developers.avacloud.io${suffix}${req.nextUrl.search}`);
    return NextResponse.rewrite(target);
  }

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
  const custom_attributes = token?.custom_attributes as string[] ?? []

  if (!isAuthenticated && !isLoginPage) {
    const protectedPaths = [
      "/hackathons/registration-form",
      "/hackathons/project-submission",
      "/showcase",
      "/profile"
    ];

    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

    if (isProtectedPath) {
      const currentUrl = req.url;
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", currentUrl);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAuthenticated) {
    if (isLoginPage)
      return NextResponse.redirect(new URL("/", req.url));

    if (isShowCase && !custom_attributes.includes('showcase'))
      return NextResponse.redirect(new URL("/hackathons", req.url))
  }
  
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

export const config = {
  matcher: [
    "/docs/api-reference",
    "/docs/api-reference/:path*",
    "/hackathons/registration-form/:path*",
    "/hackathons/project-submission/:path*",
    "/showcase/:path*",
    "/login/:path*",
    "/profile/:path*",
    "/academy/:path*/get-certificate",
    "/academy/:path*/certificate",
    "/console/utilities/data-api-keys",
  ],
};
