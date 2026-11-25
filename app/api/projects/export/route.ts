import { withAuth } from "@/lib/protectedRoute";
import { exportShowcase } from "@/server/services/exportShowcase";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

// exportShowcase reads these filters. It takes "true" and "false" as text too.
const exportBodySchema = z.object({
    event: z.string().optional(),
    track: z.string().optional(),
    search: z.string().optional(),
    winningProjects: z.union([z.boolean(), z.string()]).optional(),
    winningProjecs: z.union([z.boolean(), z.string()]).optional(),
});

export const POST = withAuth(async (req: NextRequest, _context: any, session: any) => {
    const customAttributes = session?.user?.custom_attributes || [];
    const hasAccess = customAttributes.includes("devrel")
        || customAttributes.includes("team1-admin")
        || customAttributes.includes("hackathonCreator");

    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await readJsonBody(req, exportBodySchema);
        if (!body) {
            return NextResponse.json(
                { error: { message: 'Invalid request body' } },
                { status: 400 }
            );
        }
        const buffer = await exportShowcase(body);
        if (!buffer) {
            return NextResponse.json(
                { message: 'No projects found' },
                { status: 404 }
            );
        }
        return new NextResponse(buffer, {
            headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        });
    } catch (error: any) {
        console.error('Error POST /api/projects/export:', error.message);
        const wrappedError = error as Error;
        return NextResponse.json(
            {
                error: {
                    message: wrappedError.message,
                    stack: wrappedError.stack,
                    cause: wrappedError.cause,
                    name: wrappedError.name
                }
            },
            { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
        );
    }
});