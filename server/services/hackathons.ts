import {
  Hackathon,
  HackathonHeader,
  HackathonStatus,
  ScheduleActivity,
} from "@/types/hackathons";
import {
  hasAtLeastOne,
  requiredField,
  validateEntity,
  Validation,
} from "./base";
import { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getDateWithTimezone } from "./date-parser";
import { getUserById } from "./getUser";
import { hackathonStagesArraySchema } from "@/lib/validations/hackathon-stage.schema";

const prisma = new PrismaClient();

const isNonEmptyString = (v: unknown): boolean =>
  typeof v === "string" && v.trim() !== "";

const isFiniteNumber = (v: unknown): boolean =>
  typeof v === "number" && Number.isFinite(v);

export const hackathonsValidations: Validation[] = [
  {
    field: "title",
    message: "Please provide a title for the hackathon.",
    validation: (hackathon: Hackathon) => requiredField(hackathon, "title"),
  },
  {
    field: "description",
    message: "A description is required.",
    validation: (hackathon: Hackathon) =>
      requiredField(hackathon, "description"),
  },
  {
    field: "start_date",
    message: "Please enter a valid date for the hackathon.",
    validation: (hackathon: Hackathon) =>
      requiredField(hackathon, "start_date"),
  },
  {
    field: "end_date",
    message: "Please enter a valid end date for the hackathon.",
    validation: (hackathon: Hackathon) => requiredField(hackathon, "end_date"),
  },
  {
    field: "location",
    message: "Please specify the location of the hackathon.",
    validation: (hackathon: Hackathon) => requiredField(hackathon, "location"),
  },
  {
    field: "tags",
    message: "Please add at least one category or tag.",
    validation: (hackathon: any) =>
      Array.isArray(hackathon?.tags) &&
      hackathon.tags.some((t: unknown) => isNonEmptyString(t)),
  },
  {
    field: "timezone",
    message: "Please select a timezone for the hackathon.",
    validation: (hackathon: any) => isNonEmptyString(hackathon?.timezone),
  },
  {
    field: "banner",
    message: "Please upload a banner image for the hackathon.",
    validation: (hackathon: any) => isNonEmptyString(hackathon?.banner),
  },
  {
    field: "small_banner",
    message: "Please upload a small banner image for the hackathon.",
    validation: (hackathon: any) => isNonEmptyString(hackathon?.small_banner),
  },
  {
    field: "total_prizes",
    message: "Total prize pool is required (use 0 if no monetary prizes).",
    validation: (hackathon: any) => isFiniteNumber(hackathon?.total_prizes),
  },
];

export const validateHackathon = (
  hackathon: Partial<HackathonHeader>
): Validation[] => validateEntity(hackathonsValidations, hackathon);

export class ValidationError extends Error {
  public details: Validation[];
  public cause: string;

  constructor(message: string, details: Validation[]) {
    super(message);
    this.cause = "ValidationError";
    this.details = details;
  }
}

function pruneContentPlaceholders(content: any): any {
  if (!content || typeof content !== "object") return content;
  const next: any = { ...content };
  if (Array.isArray(next.tracks)) {
    next.tracks = next.tracks.filter((t: any) => isNonEmptyString(t?.name));
  }
  if (Array.isArray(next.partners)) {
    next.partners = next.partners.filter((p: any) => isNonEmptyString(p?.name));
  }
  if (Array.isArray(next.resources)) {
    next.resources = next.resources.filter(
      (r: any) => isNonEmptyString(r?.title) || isNonEmptyString(r?.link),
    );
  }
  if (Array.isArray(next.speakers)) {
    next.speakers = next.speakers.filter((s: any) => isNonEmptyString(s?.name));
  }
  return next;
}

export async function getHackathonLite(
  hackathon: any
): Promise<HackathonHeader> {
  // Get user information if created_by exists
  if (hackathon.created_by) {
    try {
      const user = await getUserById(hackathon.created_by);
      hackathon.created_by_name = user?.name || user?.email || "Unknown User";
    } catch (error) {
      console.error("Error fetching user info:", error);
      hackathon.created_by_name = "Unknown User";
    }
  }

  // Get user information if updated_by exists
  if (hackathon.updated_by) {
    try {
      const user = await getUserById(hackathon.updated_by);
      hackathon.updated_by_name = user?.name || user?.email || "Unknown User";
    } catch (error) {
      console.error("Error fetching updated_by user info:", error);
      hackathon.updated_by_name = "Unknown User";
    }
  }

  return hackathon;
}

export interface GetHackathonsOptions {
  page?: number;
  pageSize?: number;
  location?: string | null;
  date?: string | null;
  status?: HackathonStatus | null;
  search?: string;
  created_by?: string | null;
  include_private?: boolean;
  cohost_email?: string | null;
  event?: string | null;
  visibility?: 'all' | 'public' | 'private';
  sort?: string;
}

export async function getHackathon(id: string) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id },
  });
  if (!hackathon)
    throw new Error("Hackathon not found", { cause: "BadRequest" });

  const hackathonContent = hackathon.content as unknown as Hackathon;
  return {
    ...hackathon,
    content: hackathonContent,
    status: getStatus(hackathon.start_date, hackathon.end_date),
    start_date: hackathon.start_date.toISOString(),
    end_date: hackathon.end_date.toISOString(),
  } as HackathonHeader;
}

const getStatus = (start_date: Date, end_date: Date) => {
  if (start_date.getTime() <= Date.now() && end_date.getTime() >= Date.now())
    return "ONGOING";
  if (start_date.getTime() > Date.now()) return "UPCOMING";
  else return "ENDED";
};

export async function getFilteredHackathons(options: GetHackathonsOptions) {
  if (
    (options.page && options.page < 1) ||
    (options.pageSize && options.pageSize < 1)
  )
    throw new Error("Pagination params invalid", { cause: "BadRequest" });

  console.warn("GET hackathons:", { page: options.page, pageSize: options.pageSize });
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  let filters: any = {};

  // Build all conditions
  const conditions: any[] = [];

  if (options.location) {
    if (options.location == "InPerson") {
      conditions.push({ NOT: { location: "Online" } });
    } else {
      conditions.push({ location: options.location });
    }
  }

  if (options.created_by || options.cohost_email) {
    const ownershipConditions: any[] = [];
    if (options.created_by) {
      // Show hackathons where user is either creator OR updater
      ownershipConditions.push(
        { created_by: options.created_by },
        { updated_by: options.created_by }
      );
    }
    if (options.cohost_email) {
      ownershipConditions.push({
        cohosts: {
          has: options.cohost_email,
        },
      });
    }

    if (ownershipConditions.length > 0) {
      conditions.push({
        OR: ownershipConditions,
      });
    }
  }

  if (options.date) {
    conditions.push({ date: options.date });
  }

  // Filter by visibility explicitly if provided, otherwise fall back to include_private behavior
  // Client-side logic: if is_public is truthy (true), show GREEN dot (public)
  //                    if is_public is falsy (false, null, undefined), show ZINC dot (private)
  // Server-side logic must match this display logic for consistency
  if (options.visibility) {
    if (options.visibility === 'public') {
      // Public: is_public is explicitly true
      conditions.push({ is_public: true });
    } else if (options.visibility === 'private') {
      // Private: is_public is falsy (false or null) - matches client display logic
      conditions.push({ OR: [{ is_public: false }, { is_public: null }] });
    }
    // If visibility === 'all', don't add any visibility condition - show all
  } else {
    // If visibility is not explicitly provided, apply default visibility rules
    if (!options.include_private) {
      conditions.push({ OR: [{ is_public: true }, { is_public: null }] });
    }
  }

  if (options.search) {
    const searchWords = options.search.split(/\s+/);
    let searchFilters: any[] = [];
    searchWords.forEach((word) => {
      searchFilters = [
        ...searchFilters,
        {
          title: {
            contains: word,
            mode: "insensitive",
          },
        },
        {
          location: {
            contains: word,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: word,
            mode: "insensitive",
          },
        },
      ];
    });
    searchFilters = [
      ...searchFilters,
      {
        tags: {
          has: options.search,
        },
      },
    ];

    conditions.push({ OR: searchFilters });
  }

  if (options.status) {
    switch (options.status) {
      case "ENDED":
        conditions.push({ end_date: { lt: new Date() } });
        break;
      case "ONGOING":
        conditions.push({
          start_date: { lte: new Date() },
          end_date: { gte: new Date() },
        });
        break;
      case "UPCOMING":
        conditions.push({ start_date: { gt: new Date() } });
        break;
    }
  }

  if (options.event) {
    const eventTypes = options.event.split(',').map((e: string) => e.trim());
    if (eventTypes.length === 1) {
      conditions.push({ event: eventTypes[0] });
    } else {
      conditions.push({ event: { in: eventTypes } });
    }
  }

  // Combine all conditions with AND
  if (conditions.length === 1) {
    filters = conditions[0];
  } else if (conditions.length > 1) {
    filters = { AND: conditions };
  }

  const hackathonCount = await prisma.hackathon.count({ where: filters });

  // Determine ordering
  let orderBy: any = { start_date: 'desc' };
  if (options.sort) {
    // Only support sorting by start_date for Hackathon model
    if (options.sort === 'start_date_asc') orderBy = { start_date: 'asc' };
    else if (options.sort === 'start_date_desc') orderBy = { start_date: 'desc' };
  }

  const hackathonList = await prisma.hackathon.findMany({
    where: filters,
    skip: offset,
    take: pageSize,
    orderBy,
  });

  const hackathons = await Promise.all(hackathonList.map(getHackathonLite));
  let hackathonsLite = hackathons;

  return {
    hackathons: hackathonsLite.map(
      (hackathon) =>
        ({
          ...hackathon,
          status: getStatus(
            new Date(hackathon.start_date),
            new Date(hackathon.end_date)
          ),
        } as HackathonHeader)
    ),
    total: hackathonCount,
    page,
    pageSize,
  };
}

export async function createHackathon(
  hackathonData: Partial<HackathonHeader>
): Promise<HackathonHeader> {
  const errors = validateHackathon(hackathonData);
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors);
  }

  /**
   * SECURITY: Validate `content.stages` with the Zod schema before persisting.
   * The `stages` field is a JSON column; without this check arbitrary nested
   * structures could be written to the database.  Return a ValidationError
   * (which the API layer maps to 400) so callers get actionable feedback.
   */
  if (hackathonData.content?.stages !== undefined) {
    const stagesResult = hackathonStagesArraySchema.safeParse(hackathonData.content.stages);
    if (!stagesResult.success) {
      throw new ValidationError(
        "Invalid stages data",
        [{ field: "content.stages", message: JSON.stringify(stagesResult.error.flatten()), validation: () => false }]
      );
    }
    hackathonData.content.stages = stagesResult.data;
  }

  if (hackathonData.content?.schedule) {
    const schedule = hackathonData.content.schedule
      .filter((activity: ScheduleActivity) => typeof activity?.date === "string" && activity.date.trim() !== "")
      .map((activity: ScheduleActivity) => {
        activity.date = getDateWithTimezone(
          activity.date,
          hackathonData.timezone ?? ""
        ).toISOString();
        return activity;
      });
    hackathonData.content!.schedule = schedule;
  }
  hackathonData.content = pruneContentPlaceholders(hackathonData.content);
  const content = { ...hackathonData.content } as Prisma.JsonObject;
  const newHackathon = await prisma.hackathon.create({
    data: {
      created_by: hackathonData.created_by,
      id: hackathonData.id,
      title: hackathonData.title!,
      description: hackathonData.description!,
      start_date: getDateWithTimezone(
        hackathonData.start_date!,
        hackathonData.timezone!
      ),
      end_date: getDateWithTimezone(
        hackathonData.end_date!,
        hackathonData.timezone!
      ),
      location: hackathonData.location!,
      total_prizes: hackathonData.total_prizes!,
      participants: hackathonData.participants ?? 0,
      tags: hackathonData.tags!,
      timezone: hackathonData.timezone!,
      cohosts: hackathonData.cohosts ?? [],
      icon: hackathonData.icon!,
      banner: hackathonData.banner!,
      small_banner: hackathonData.small_banner!,
      top_most: hackathonData.top_most ?? false,
      content: content,
      event: hackathonData.event ?? 'hackathon',
      new_layout: hackathonData.new_layout ?? false,
      is_public: hackathonData.is_public ?? false,
      organizers: hackathonData.organizers,
      google_calendar_id: hackathonData.google_calendar_id,
    },
  });
  hackathonData.id = newHackathon.id;
  revalidatePath("/api/events/");
  return hackathonData as HackathonHeader;
}

export async function updateHackathon(
  id: string,
  hackathonData: Partial<HackathonHeader>,
  userId?: string
): Promise<HackathonHeader> {
  // Skip validation if we're only updating is_public field
  const isOnlyPublicUpdate =
    Object.keys(hackathonData).length === 1 &&
    hackathonData.hasOwnProperty("is_public");

  if (!isOnlyPublicUpdate) {
    const errors = validateHackathon(hackathonData);
    if (errors.length > 0) {
      throw new ValidationError("Validation failed", errors);
    }

    /**
     * SECURITY: Validate `content.stages` with the Zod schema before
     * persisting to the database.  Unvalidated JSON columns are a schema-
     * injection risk; an attacker could store arbitrary structures that
     * affect rendering or downstream processing.
     */
    if (hackathonData.content?.stages !== undefined) {
      const stagesResult = hackathonStagesArraySchema.safeParse(hackathonData.content.stages);
      if (!stagesResult.success) {
        throw new ValidationError(
          "Invalid stages data",
          [{ field: "content.stages", message: JSON.stringify(stagesResult.error.flatten()), validation: () => false }]
        );
      }
      hackathonData.content.stages = stagesResult.data;
    }
  }

  const existingHackathon = await prisma.hackathon.findUnique({
    where: { id },
  });
  if (!existingHackathon) {
    throw new Error("Hackathon not found");
  }

  if (hackathonData.content?.schedule) {
    const schedule = hackathonData.content.schedule
      .filter((activity: ScheduleActivity) => typeof activity?.date === "string" && activity.date.trim() !== "")
      .map((activity: ScheduleActivity) => {
        activity.date = getDateWithTimezone(
          activity.date,
          hackathonData.timezone ?? ""
        ).toISOString();
        return activity;
      });
    hackathonData.content!.schedule = schedule;
  }
  if (hackathonData.content) {
    hackathonData.content = pruneContentPlaceholders(hackathonData.content);
  }
  // Build update data object with only provided fields
  const updateData: any = {};

  if (hackathonData.title !== undefined) updateData.title = hackathonData.title;
  if (hackathonData.description !== undefined)
    updateData.description = hackathonData.description;
  if (hackathonData.start_date !== undefined) {
    updateData.start_date = getDateWithTimezone(
      hackathonData.start_date,
      hackathonData.timezone ?? existingHackathon.timezone
    );
  }
  if (hackathonData.end_date !== undefined) {
    updateData.end_date = getDateWithTimezone(
      hackathonData.end_date,
      hackathonData.timezone ?? existingHackathon.timezone
    );
  }
  if (hackathonData.location !== undefined)
    updateData.location = hackathonData.location;
  if (hackathonData.total_prizes !== undefined)
    updateData.total_prizes = hackathonData.total_prizes;
  if (hackathonData.tags !== undefined) updateData.tags = hackathonData.tags;
  if (hackathonData.timezone !== undefined)
    updateData.timezone = hackathonData.timezone;
  if (hackathonData.icon !== undefined) updateData.icon = hackathonData.icon;
  if (hackathonData.banner !== undefined)
    updateData.banner = hackathonData.banner;
  if (hackathonData.small_banner !== undefined)
    updateData.small_banner = hackathonData.small_banner;
  if (hackathonData.participants !== undefined)
    updateData.participants = hackathonData.participants;
  if (hackathonData.top_most !== undefined)
    updateData.top_most = hackathonData.top_most;
  if (hackathonData.organizers !== undefined)
    updateData.organizers = hackathonData.organizers;
  if (hackathonData.cohosts !== undefined)
    updateData.cohosts = hackathonData.cohosts;
  if (hackathonData.custom_link !== undefined)
    updateData.custom_link = hackathonData.custom_link;
  if (hackathonData.created_by !== undefined)
    updateData.created_by = hackathonData.created_by;
  if (hackathonData.is_public !== undefined)
    updateData.is_public = hackathonData.is_public;
  if (hackathonData.event !== undefined)
    updateData.event = hackathonData.event;
  if (hackathonData.new_layout !== undefined)
    updateData.new_layout = hackathonData.new_layout;
  if (userId) updateData.updated_by = userId;
  if (hackathonData.google_calendar_id !== undefined)
    updateData.google_calendar_id = hackathonData.google_calendar_id;
  if (hackathonData.content !== undefined) {
    const content = {
      ...hackathonData.content,
    } as unknown as Prisma.JsonObject;
    updateData.content = content;
  }

  await prisma.hackathon.update({
    where: { id },
    data: updateData,
  });
  revalidatePath(`/api/events/${id}`);
  revalidatePath("/api/events/");
  return hackathonData as HackathonHeader;
}
