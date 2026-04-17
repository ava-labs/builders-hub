import { z } from "zod";

/**
 * Shared Zod schemas for the extended user profile.
 *
 * These schemas are the single source of truth for validating
 * profile update requests and are consumed by both the backend API
 * route and the frontend forms.
 */

/** A notification preference tuple: [inHub, byEmail]. */
const NotificationPreferenceSchema = z.tuple([z.boolean(), z.boolean()]);

/** Map from notification key to its preference tuple. */
export const NotificationMeansSchema = z.record(
  z.string(),
  NotificationPreferenceSchema,
);

/** User type data stored as JSON in the database (nested form). */
export const UserTypeSchema = z.object({
  is_student: z.boolean(),
  is_founder: z.boolean(),
  is_employee: z.boolean(),
  is_developer: z.boolean(),
  is_enthusiast: z.boolean(),
  student_institution: z.string().optional(),
  founder_company_name: z.string().optional(),
  employee_company_name: z.string().optional(),
  employee_role: z.string().optional(),
  company_name: z.string().optional(),
  role: z.string().optional(),
});

/**
 * Schema for PUT/PATCH requests to /api/profile/extended/[id].
 *
 * All fields are optional to allow partial updates. Unknown fields are
 * stripped silently (default Zod behavior), which acts as a safe whitelist
 * and prevents arbitrary columns from being forwarded to Prisma.
 */
export const UpdateExtendedProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty.").optional(),
    username: z.string().optional(),
    bio: z
      .string()
      .max(250, "Bio must not exceed 250 characters.")
      .nullable()
      .optional(),
    // NOTE: `email` is intentionally excluded. It represents the user's identity
    // and must not be mutable from this endpoint. Zod will strip it from any
    // incoming payload by default, preventing impersonation attempts.
    notification_email: z
      .email("Invalid notification email.")
      .nullable()
      .optional(),
    image: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    github: z
      .union([z.literal(""), z.url("Invalid GitHub URL.")])
      .nullable()
      .optional(),
    wallet: z.array(z.string()).nullable().optional(),
    socials: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    notifications: z.boolean().nullable().optional(),
    profile_privacy: z.string().nullable().optional(),
    telegram_user: z.string().nullable().optional(),
    notification_means: NotificationMeansSchema.nullable().optional(),
    user_type: UserTypeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No data provided for update.",
  });

export type UpdateExtendedProfileInput = z.infer<
  typeof UpdateExtendedProfileSchema
>;
