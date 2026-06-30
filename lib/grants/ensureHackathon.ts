import { prisma } from "@/prisma/prisma";
import { GRANT_PROGRAMS } from "@/lib/grants/programs";

/**
 * Idempotently ensures the hidden Hackathon row that backs a grant program
 * exists, and returns its id. Grant submissions set `Project.hackaton_id` to
 * this id, so the row MUST exist before a submission is written. Calling this
 * on the submission path makes fresh environments self-heal instead of relying
 * on someone having run the seed script. Safe to call repeatedly (upsert).
 */
export async function ensureGrantHackathon(programKey: string): Promise<string> {
  const program = GRANT_PROGRAMS[programKey];
  if (!program) throw new Error(`Unknown grant program: ${programKey}`);

  await prisma.hackathon.upsert({
    where: { id: program.hackathonId },
    update: { title: program.title, is_public: false, event: "grant" },
    create: {
      id: program.hackathonId,
      title: program.title,
      description: `Hidden container backing the ${program.title} application + review flow.`,
      location: "Online",
      total_prizes: 0,
      participants: 0,
      tags: [],
      is_public: false,
      event: "grant",
    },
  });

  return program.hackathonId;
}
