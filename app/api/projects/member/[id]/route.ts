import { withAuth } from "@/lib/protectedRoute";
import { GetProjectsByUserId } from "@/server/services/memberProject";
import { NextResponse } from "next/server";

export const GET = withAuth(async (_, context: any) => {
    try {
        const { id } = await context.params;
        const projects = await GetProjectsByUserId(id);
        return NextResponse.json(projects);
    } catch (error: any) {
        console.error("Error getting projects:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});