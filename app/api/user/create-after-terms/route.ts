import { z } from 'zod';
import { withApi, successResponse } from '@/lib/api';
import { prisma } from '@/prisma/prisma';
import { syncUserDataToHubSpot } from '@/server/services/hubspotUserData';

const CreateAfterTermsSchema = z.object({
  notifications: z.boolean().optional().default(false),
});

/**
 * Create a new user after they accept terms.
 * Called when a user verifies their email via OTP but hasn't been
 * created in the database yet (to avoid creating accounts for users who
 * don't accept terms).
 */
export const POST = withApi<z.infer<typeof CreateAfterTermsSchema>>(
  async (_req, { session, body }) => {
    const email = session.user.email;

    // Check if user already exists (shouldn't happen, but safety check)
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return successResponse({
        id: existingUser.id,
        email: existingUser.email,
        alreadyExists: true,
      });
    }

    const { notifications } = body;

    // Create the new user
    const newUser = await prisma.user.create({
      data: {
        email,
        notification_email: email,
        name: '',
        image: '',
        authentication_mode: 'credentials',
        last_login: new Date(),
        notifications,
      },
    });

    // Sync user data to HubSpot (after terms acceptance)
    if (newUser.email) {
      try {
        await syncUserDataToHubSpot({
          email: newUser.email,
          name: newUser.name || undefined,
          notifications: newUser.notifications ?? undefined,
          gdpr: true, // User accepted terms and conditions
        });
      } catch {
        // Don't block user creation if HubSpot sync fails
      }
    }

    return successResponse({
      id: newUser.id,
      email: newUser.email,
      created: true,
    });
  },
  { auth: true, schema: CreateAfterTermsSchema },
);
