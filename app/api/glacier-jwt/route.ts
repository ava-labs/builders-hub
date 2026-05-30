import { getAuthSession } from "@/lib/auth/authSession";
import { createGlacierJWT } from "@/lib/glacier-jwt";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const DATA_API_ENDPOINT = "https://data-api.avax.network/v1";

  try {
    const glacierJwt = await createGlacierJWT({
      sub: session.user.id,
      iss: "https://build.avax.network/",
      email: session.user.email!,
    });

    return NextResponse.json({ glacierJwt, endpoint: DATA_API_ENDPOINT });
  } catch (error) {
    console.error("Failed to create glacier JWT:", error);
    return NextResponse.json(
      { error: "Failed to generate JWT" },
      { status: 500 }
    );
  }
}
