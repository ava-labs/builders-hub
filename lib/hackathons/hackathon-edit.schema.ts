import { z } from "zod";
import { SubmitFormFieldType } from "@/types/hackathon-stage";

const textFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Text),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().max(240),
  description: z.string().max(400),
  required: z.boolean(),
  maxCharacters: z.number().int().positive().max(5000).nullable(),
  rows: z.number().int().positive().max(20).nullable(),
});

const linkFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Link),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().max(240),
  description: z.string().max(400),
  required: z.boolean(),
});

const chipsFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Chips),
  label: z.string().trim().min(1).max(120),
  description: z.string().max(400),
  required: z.boolean(),
  chips: z.array(z.string().trim().min(1).max(40)).max(20),
});

const submitFieldSchema = z.discriminatedUnion("type", [
  textFieldSchema,
  linkFieldSchema,
  chipsFieldSchema,
]);

const stageSchema = z.object({
  label: z.string().max(120),
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
  name: z.string().max(120),
  logo: z.string().max(2048),
});

const trackSchema = z.object({
  icon: z.string().max(128),
  logo: z.string().max(2048),
  name: z.string().max(120),
  partner: z.string().max(120),
  description: z.string().max(5000),
  short_description: z.string().max(1000),
});

const scheduleSchema = z.object({
  url: z.string().max(2048).nullable(),
  date: z.string().max(64),
  name: z.string().max(180),
  category: z.string().max(120),
  location: z.string().max(120),
  description: z.string().max(2000),
  duration: z.number().int().min(0).max(1440),
});

const speakerSchema = z.object({
  icon: z.string().max(128),
  name: z.string().max(120),
  category: z.string().max(120),
  picture: z.string().max(2048),
});

const resourceSchema = z.object({
  icon: z.string().max(128),
  link: z.string().max(2048),
  title: z.string().max(120),
  description: z.string().max(500),
});

export const hackathonEditSchema = z.object({
  main: z.object({
    title: z.string().trim().min(3).max(30),
    description: z.string().trim().min(10).max(270),
    location: z.string().trim().min(2).max(40),
    total_prizes: z.number().min(0).max(100_000_000),
    tags: z.array(z.string().max(30)).max(10),
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
    speakers_banner: z.string().max(2048),
    join_custom_link: z.string().max(2048),
    join_custom_text: z.string().max(300).nullable(),
    become_sponsor_link: z.string().max(2048),
    submission_custom_link: z.string().max(2048).nullable(),
    judging_guidelines: z.string().max(20_000),
    submission_deadline: z.string().max(64),
    registration_deadline: z.string().max(64),
    stages: z.array(stageSchema).max(12).optional().default([]),
  }),
  latest: z.object({
    start_date: z.string().max(64),
    end_date: z.string().max(64),
    timezone: z.string().max(100),
    banner: z.string().max(2048),
    icon: z.string().max(2048),
    small_banner: z.string().max(2048),
    custom_link: z.string().max(2048).nullable(),
    top_most: z.boolean(),
    event: z.string().max(64),
    new_layout: z.boolean(),
    google_calendar_id: z.string().max(300).nullable(),
  }),
  cohostsEmails: z.array(z.string().email()).max(50),
});

export type HackathonEditFormValues = z.infer<typeof hackathonEditSchema>;
