import { withAuth } from "@/lib/protectedRoute";
import { GetProjectsByUserId } from "@/server/services/memberProject";
import { NextResponse } from "next/server";

export const GET = withAuth(async (_, context: any, session: any) => {
    try {
        const projects = await GetProjectsByUserId(session.user.id);
        return NextResponse.json(projects);
    } catch (error: any) {
        console.error("Error getting projects:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});