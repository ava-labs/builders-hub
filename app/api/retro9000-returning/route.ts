import { NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { prisma } from '@/prisma/prisma';
import { withAuth } from '@/lib/protectedRoute';
import { normalizeEmail } from '@/lib/utils';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/json-body';

// Each text field may be empty or missing: the handler stores '' or null in its place.
const text = z.string().nullish();
const bodySchema = z.object({
  project_name: text,
  project_type: text,
  project_vertical: text,
  project_website: text,
  project_x_handle: text,
  project_github: text,
  project_hq: text,
  project_continent: text,
  media_kit: text,
  previous_retro9000_snapshot_funding: text,
  requested_funding_range: text,
  eligibility_and_metrics: text,
  requested_grant_size_budget: text,
  changes_since_last_snapshot: text,
  first_name: text,
  last_name: text,
  pseudonym: text,
  role: text,
  x_account: text,
  telegram: text,
  linkedin: text,
  github: text,
  country: text,
  other_url: text,
  bio: text,
  kyb_willing: text,
  gdpr: z.boolean().nullish(),
  marketing_consent: z.boolean().nullish(),
});

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
    const formData = await readJsonBody(request, bodySchema);
    if (!formData) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }
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
      project_name: formData.project_name || '',
      project_type: formData.project_type || '',
      project_vertical: formData.project_vertical || '',
      project_website: formData.project_website || null,
      project_x_handle: formData.project_x_handle || null,
      project_github: formData.project_github || '',
      project_hq: formData.project_hq || '',
      project_continent: formData.project_continent || '',
      media_kit: formData.media_kit || '',
      // FINANCIAL OVERVIEW
      previous_retro9000_snapshot_funding: formData.previous_retro9000_snapshot_funding || null,
      requested_funding_range: formData.requested_funding_range || '',
      // GRANT INFORMATION
      eligibility_and_metrics: formData.eligibility_and_metrics || '',
      requested_grant_size_budget: formData.requested_grant_size_budget || '',
      changes_since_last_snapshot: formData.changes_since_last_snapshot || '',
      // APPLICANT INFORMATION
      first_name: formData.first_name || '',
      last_name: formData.last_name || '',
      pseudonym: formData.pseudonym || null,
      role: formData.role || '',
      x_account: formData.x_account || '',
      telegram: formData.telegram || '',
      linkedin: formData.linkedin || null,
      github: formData.github || null,
      country: formData.country || null,
      other_url: formData.other_url || null,
      bio: formData.bio || '',
      // COMPLIANCE
      kyb_willing: formData.kyb_willing || '',
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
