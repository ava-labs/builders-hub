import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getServerSession } from "next-auth";
import { AuthOptions } from "@/lib/auth/authOptions";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(AuthOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/backend/authenticate`,
      {
        email: session.user.email,
      },
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.T1_TOKEN_API_KEY as string,
        },
      }
    );

    const nextResponse = NextResponse.json({
      success: true,
      message: "External authentication successful",
      data: response.data,
    });

    const cookies = response.headers["set-cookie"];
    if (cookies) {
      cookies.forEach((cookie) => {
        nextResponse.headers.append("Set-Cookie", cookie);
      });
    }

    return nextResponse;
  } catch (error: any) {
    console.error(
      "External token error:",
      error.response?.data || error.message
    );

    return NextResponse.json(
      {
        error: "Failed to get external token",
        details: error.response?.data?.message || error.message,
      },
      { status: error.response?.status || 500 }
    );
  }
}
