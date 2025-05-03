import { createRegisterForm, getRegisterForm } from "@/server/services/registerForms";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/protectedRoute";

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const newHackathon = await createRegisterForm(body);

    return NextResponse.json(
      { message: 'registration form created', hackathon: newHackathon },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error POST /api/register-form:', error.message);
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

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const id = req.nextUrl.searchParams.get("hackathonId");
    const email = req.nextUrl.searchParams.get("email");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const registerFormLoaded = await getRegisterForm(email, id);

    return NextResponse.json(registerFormLoaded);
  } catch (error) {
    console.error("Error in GET /api/register-form/", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
});
