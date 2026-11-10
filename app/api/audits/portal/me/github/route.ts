import { NextResponse } from "next/server";
import { withAuditor } from "@/app/api/audits/portal/utils";
import { applyRateLimit, DAY_MS } from "@/app/api/audits/utils";
import { auditorGithubUpdateSchema } from "@/types/audits";
import { setOwnGithubUsername } from "@/server/services/audits/auditors";

/**
 * The signed-in person sets or clears their own GitHub username (the quote
 * email or an approved teammate). The body names the value only; the session
 * address picks the row. No allowInactive, so a deactivated firm's write
 * fails 403. The budget is keyed on the signed-in address.
 */
export const PATCH = withAuditor(async (request, _context, auditor, actorEmail) => {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ success: false, message: "Send JSON." }, { status: 415 });
  }
  const limited = applyRateLimit("github-update", actorEmail, {
    windowMs: DAY_MS,
    maxRequests: 50,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = auditorGithubUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { success: false, message: errors.github_username?.[0] ?? "Validation failed", errors },
      { status: 400 },
    );
  }

  try {
    const result = await setOwnGithubUsername(auditor, actorEmail, parsed.data.github_username);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Email not found on this firm." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, github_username: result.github_username });
  } catch (err) {
    console.error("[Audits] GitHub username update failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't save your GitHub username right now." },
      { status: 500 },
    );
  }
});
