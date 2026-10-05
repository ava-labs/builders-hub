import { NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { prisma } from '@/prisma/prisma';
import { withAuth } from '@/lib/protectedRoute';
import { normalizeEmail } from '@/lib/utils';

/**
 * The application row is keyed by email, and the upsert overwrites every field
 * of an existing row. The email therefore decides *whose* application is being
 * written, which makes it an authorisation input — it comes from the session,
 * never from the request body. Taking it from the body let anyone overwrite any
 * applicant's submission by naming their address.
 *
 * The form already renders this field disabled and prefilled from the session,
 * so binding it here matches what the UI has always shown the user.
 */
export const POST = withAuth(async (request: Request, _context: unknown, session: Session) => {
  try {
    const formData = await request.json();
    // Normalised with the shared helper, matching how the signup path keys
    // users, so the upsert cannot be split across casing variants.
    const sessionEmail = session.user?.email;
    const email = sessionEmail ? normalizeEmail(sessionEmail) : undefined;
    if (!email) {
      return NextResponse.json(
        { success: false, message: 'A verified account email is required' },
        { status: 400 }
      );
    }

    const applicationData = {
      email: email,
      // PROJECT OVERVIEW
      project_name: (formData.project_name as string) || '',
      project_type: (formData.project_type as string) || '',
      project_vertical: (formData.project_vertical as string) || '',
      project_website: (formData.project_website as string) || null,
      project_x_handle: (formData.project_x_handle as string) || null,
      project_github: (formData.project_github as string) || '',
      project_hq: (formData.project_hq as string) || '',
      project_continent: (formData.project_continent as string) || '',
      media_kit: (formData.media_kit as string) || '',
      // FINANCIAL OVERVIEW
      previous_retro9000_snapshot_funding: (formData.previous_retro9000_snapshot_funding as string) || null,
      requested_funding_range: (formData.requested_funding_range as string) || '',
      // GRANT INFORMATION
      eligibility_and_metrics: (formData.eligibility_and_metrics as string) || '',
      requested_grant_size_budget: (formData.requested_grant_size_budget as string) || '',
      changes_since_last_snapshot: (formData.changes_since_last_snapshot as string) || '',
      // APPLICANT INFORMATION
      first_name: (formData.first_name as string) || '',
      last_name: (formData.last_name as string) || '',
      pseudonym: (formData.pseudonym as string) || null,
      role: (formData.role as string) || '',
      x_account: (formData.x_account as string) || '',
      telegram: (formData.telegram as string) || '',
      linkedin: (formData.linkedin as string) || null,
      github: (formData.github as string) || null,
      country: (formData.country as string) || null,
      other_url: (formData.other_url as string) || null,
      bio: (formData.bio as string) || '',
      // COMPLIANCE
      kyb_willing: (formData.kyb_willing as string) || '',
      gdpr: formData.gdpr === true,
      marketing_consent: formData.marketing_consent === true,
    };

    const result = await prisma.retro9000ReturningApplication.upsert({
      where: { email: email },
      update: {
        project_name: applicationData.project_name,
        project_type: applicationData.project_type,
        project_vertical: applicationData.project_vertical,
        project_website: applicationData.project_website,
        project_x_handle: applicationData.project_x_handle,
        project_github: applicationData.project_github,
        project_hq: applicationData.project_hq,
        project_continent: applicationData.project_continent,
        media_kit: applicationData.media_kit,
        previous_retro9000_snapshot_funding: applicationData.previous_retro9000_snapshot_funding,
        requested_funding_range: applicationData.requested_funding_range,
        eligibility_and_metrics: applicationData.eligibility_and_metrics,
        requested_grant_size_budget: applicationData.requested_grant_size_budget,
        changes_since_last_snapshot: applicationData.changes_since_last_snapshot,
        first_name: applicationData.first_name,
        last_name: applicationData.last_name,
        pseudonym: applicationData.pseudonym,
        role: applicationData.role,
        x_account: applicationData.x_account,
        telegram: applicationData.telegram,
        linkedin: applicationData.linkedin,
        github: applicationData.github,
        country: applicationData.country,
        other_url: applicationData.other_url,
        bio: applicationData.bio,
        kyb_willing: applicationData.kyb_willing,
        gdpr: applicationData.gdpr,
        marketing_consent: applicationData.marketing_consent,
      },
      create: applicationData,
    });
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    // Log the detail, return none of it: the raw message carries Prisma column
    // and constraint names straight to the client.
    console.error('Error processing Retro9000 Returning application:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
});
