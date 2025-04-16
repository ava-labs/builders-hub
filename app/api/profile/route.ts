import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateProfile } from "@/server/services/profile";
import { Profile } from "@/types/profile"

export async function GET(req: NextRequest) {
    try {
        const email = req.nextUrl.searchParams.get("email");
        if (!email) {
          return NextResponse.json({ error: "Email parameter is required."}, { status: 400 });
        }

        const profile = await getProfile(email);
        return NextResponse.json(profile);
    } catch (error) {
        console.error("Error in GET /api/profile/[email]", error);
        return NextResponse.json({ error: `Internal Server Error: ${error}`}, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const email = req.nextUrl.searchParams.get("email")!;
        const newProfileData = await req.json() as Partial<Profile>;

        const updatedProfile = await updateProfile(email ?? newProfileData.email, newProfileData);

        return NextResponse.json(updatedProfile);
    } catch (error) {
        console.error("Error in PUT /api/profile/[email]:", error);
        return NextResponse.json({ error: `Internal Server Error: ${error}`}, { status: 500 });
    }
}
