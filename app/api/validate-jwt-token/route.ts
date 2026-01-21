import { NextRequest, NextResponse } from "next/server";
import {decode} from "next-auth/jwt"
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET: string | undefined = process.env.NEXTAUTH_SECRET;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!JWT_SECRET) {
      return NextResponse.json(
        { valid: false, error: "Error at validate token" },
        { status: 500 }
      );
    }

    const authHeader: string | null = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { valid: false, error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const token: string = authHeader;

    const decoded: string | JwtPayload = await decode({token, secret: JWT_SECRET}) ?? {};

    if (typeof decoded !== "object" || decoded === null) {
      return NextResponse.json(
        { valid: false, error: "Invalid token payload" },
        { status: 401 }
      );
    }

    const sub: unknown = decoded.sub;
    if (typeof sub !== "string" || sub.length === 0) {
      return NextResponse.json(
        { valid: false, error: "Token missing sub" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      sub,
      payload: decoded,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { valid: false, error: "Invalid token", details: String(err) },
      { status: 401 }
    );
  }
}