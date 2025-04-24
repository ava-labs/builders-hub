import { getToken } from "next-auth/jwt";
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { NextMiddlewareResult } from "next/dist/server/web/types";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
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
  const pathname = req.nextUrl.pathname;
  const isAuthenticated = !!token;
  const isLoginPage = pathname === "/login";
  const isShowCase = pathname.startsWith("/showcase");
  const custom_attributes = token?.custom_attributes as string[] ?? []
  
  if (isAuthenticated) {

    if (isLoginPage)
      return NextResponse.redirect(new URL("/", req.url));

    //TODO Change this line to enable showcase to a different set of users
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
    "/hackathons/registration-form/:path*",
    "/hackathons/project-submission/:path*",
    "/showcase/:path*",
    "/login/:path*",
    "/profile/:path*",
  ],
};
