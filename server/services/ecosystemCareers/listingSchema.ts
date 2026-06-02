import { z } from 'zod';
import { isHttpUrl } from '@/lib/ecosystem-careers/isHttpUrl';

export const REMOTE_TYPES = ['remote', 'onsite', 'hybrid'] as const;
export const EMPLOYMENT_TYPES = ['full_time', 'contract', 'part_time'] as const;

export const listingBodySchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(2).max(160),
  short_description: z.string().max(280).optional().nullable(),
  description: z.string().min(20),
  location: z.string().max(120).optional().nullable(),
  remote_type: z.enum(REMOTE_TYPES).optional().nullable(),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional().nullable(),
  seniority: z.string().max(40).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(6).optional(),
  apply_url: z
    .string()
    .url()
    .refine(isHttpUrl, { message: 'apply_url must be an http(s) URL' }),
});

export type ListingBody = z.infer<typeof listingBodySchema>;
