import { withAuth } from "@/lib/protectedRoute";
import { exportShowcase } from "@/server/services/exportShowcase";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/roles";

export const POST = withAuth(async (req: NextRequest, _context: any, session: any) => {
    const customAttributes = session?.user?.custom_attributes || [];
    const hasAccess = hasPermission(customAttributes, { resource: "hackathon", action: "write" });

    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
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