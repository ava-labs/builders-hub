import { z } from "zod";
import { SubmitFormFieldType } from "@/types/hackathon-stage";

const URL_ERROR = 'Please enter a valid URL starting with https:// (e.g., https://example.com)';
const IMG_URL_ERROR = 'Please enter a valid image URL starting with https:// (e.g., https://example.com/image.png)';

const urlOrEmptySchema = z.union([z.url(URL_ERROR), z.literal("")]);
const nullableUrlOrEmptySchema = z.union([z.url(URL_ERROR), z.literal(""), z.null()]);

/** File picker preview in editor uses data URLs; union ensures they validate even if z.url() is strict. */
const imageUrlSchema = z.union([
  z.url(IMG_URL_ERROR),
  z
    .string()
    .max(2_500_000)
    .refine((s) => s.startsWith("data:image/"), { message: "Invalid picture data URL" }),
  z
    .string()
    .max(2_500_000)
    .refine((s) => s.startsWith("/temp"), { message: "Invalid picture data URL" }),
  z.literal(""),
]);

const textFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Text),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().max(240).optional(),
  description: z.string().max(400).optional(),
  required: z.boolean(),
  maxCharacters: z.number().int().positive().max(5000).nullable(),
  predefinedField: z.boolean().optional(),
});

const linkFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Link),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().max(240).optional(),
  description: z.string().max(400).optional(),
  required: z.boolean(),
  maxLinks: z.number().int().positive().max(50).optional(),
  predefinedField: z.boolean().optional(),
});

const chipsFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Chips),
  label: z.string().trim().min(1).max(120),
  description: z.string().max(400).optional(),
  required: z.boolean(),
  chips: z.array(z.string().trim().min(1).max(40)).max(20),
  predefinedField: z.boolean().optional(),
});

const multiSelectFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.MultiSelect),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().max(240).optional(),
  description: z.string().max(400).nullable().optional(),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(50),
  maxSelections: z.number().int().positive().max(50).nullable().optional(),
  predefinedField: z.boolean().optional(),
});

const submitFieldSchema = z.discriminatedUnion("type", [
  textFieldSchema,
  linkFieldSchema,
  chipsFieldSchema,
  multiSelectFieldSchema,
]);

const stageSchema = z.object({
  label: z.string().trim().min(1).max(120),
  date: z.string().max(64),
  deadline: z.string().max(64),
  component: z.unknown().optional(),
  submitForm: z
    .object({
      fields: z.array(submitFieldSchema).max(25),
    })
    .optional(),
});

const partnersSchema = z.object({
  name: z.string().min(1).max(120),
  logo: imageUrlSchema,
});

const trackSchema = z.object({
  icon: z.string().max(128),
  logo: z.string().max(2048),
  // min(1) is enforced via superRefine only when event === 'hackathon'
  name: z.string().max(120),
  partner: z.string().max(120),
  description: z.string().max(5000),
  short_description: z.string().max(1000),
});

const scheduleSchema = z.object({
  url: nullableUrlOrEmptySchema,
  date: z.string().min(1, 'Date is required').max(64),
  name: z.string().min(1).max(100),
  category: z.string().max(30),
  location: z.string().max(100),
  description: z.string().max(500),
  duration: z.number().int().min(0).max(500),
});

const speakerSchema = z.object({
  // icon: z.string().max(128),
  name: z.string().max(120),
  category: z.string().max(120),
  picture: imageUrlSchema,
});

const resourceSchema = z.object({
  icon: z.string().max(128),
  link: urlOrEmptySchema,
  title: z.string().min(1).max(120),
  description: z.string().max(500),
});

export const hackathonEditSchema = z.object({
  main: z.object({
    title: z.string().trim().min(3).max(50),
    description: z.string().trim().min(10).max(540),
    location: z.string().trim().min(2).max(100),
    total_prizes: z.number().min(0).max(100_000_000),
    tags: z.array(z.string().max(30)).min(1).max(10),
    participants: z.number().min(0).max(1_000_000).optional(),
    organizers: z.string().max(200).optional(),
    is_public: z.boolean().optional(),
  }),
  content: z.object({
    language: z.enum(["en", "es"]).optional(),
    tracks: z.array(trackSchema).max(30),
    address: z.string().max(300),
    partners: z.array(partnersSchema).max(50),
    schedule: z.array(scheduleSchema).max(250),
    speakers: z.array(speakerSchema).max(200),
    resources: z.array(resourceSchema).max(100),
    tracks_text: z.string().max(20_000),
    speakers_text: z.string().max(20_000),
    speakers_banner: z.string(),
    join_custom_link: nullableUrlOrEmptySchema,
    join_custom_text: z.string().max(300).nullable(),
    become_sponsor_link: nullableUrlOrEmptySchema,
    submission_custom_link: nullableUrlOrEmptySchema,
    judging_guidelines: z.string().max(20_000),
    submission_deadline: z.string().max(64).refine(
      (val) => val === '' || !isNaN(new Date(val).getTime()),
      { message: 'Please enter a valid date and time' }
    ),
    registration_deadline: z.string().max(64).refine(
      (val) => val === '' || !isNaN(new Date(val).getTime()),
      { message: 'Please enter a valid date and time' }
    ),
    stages: z.array(stageSchema).max(12).optional().default([]),
  }),
  latest: z.object({
    start_date: z.string().trim().min(1, 'Please set a start date for the event.').max(64),
    end_date: z.string().trim().min(1, 'Please set an end date for the event.').max(64),
    timezone: z.string().trim().min(1, 'Please select a timezone.').max(100),
    banner: imageUrlSchema,
    icon: z.string(),
    small_banner: imageUrlSchema,
    custom_link: nullableUrlOrEmptySchema,
    top_most: z.boolean(),
    event: z.string().max(64),
    new_layout: z.boolean(),
    google_calendar_id: z.string().max(300).nullable(),
  }),
  cohostsEmails: z.array(z.string().email()).max(50),
}).superRefine((data, ctx) => {
  // Tracks are only relevant for hackathon events. When the event type is
  // different (bootcamp, workshop, …) the Tracks section is hidden, so we
  // must skip track-level validation to avoid blocking the save.
  if (data.latest.event === 'hackathon') {
    data.content.tracks.forEach((track, index) => {
      if (!track.name || track.name.trim().length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'String must contain at least 1 character(s)',
          path: ['content', 'tracks', index, 'name'],
        });
      }
    });
  }

  const deadline = data.content.submission_deadline;
  const startDate = data.latest.start_date;
  const endDate = data.latest.end_date;
  if (deadline) {
    const deadlineDate = new Date(deadline);
    if (!isNaN(deadlineDate.getTime())) {
      if (startDate) {
        const startDateTime = new Date(startDate);
        if (!isNaN(startDateTime.getTime()) && deadlineDate < startDateTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Submission deadline must be after the hackathon start date',
            path: ['content', 'submission_deadline'],
          });
          return;
        }
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        if (!isNaN(endDateTime.getTime()) && deadlineDate > endDateTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Submission deadline must be before the hackathon end date',
            path: ['content', 'submission_deadline'],
          });
        }
      }
    }
  }
});

export type HackathonEditFormValues = z.infer<typeof hackathonEditSchema>;
