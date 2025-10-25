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

const prisma = new PrismaClient();

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
    validation: (hackathon: Hackathon) => hasAtLeastOne(hackathon, "tags"),
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

export async function getHackathonLite(hackathon: any): Promise<HackathonHeader> {
  if (!hackathon.top_most) delete hackathon.content;
  
  // Get user information if created_by exists
  if (hackathon.created_by) {
    try {
      const user = await getUserById(hackathon.created_by);
      hackathon.created_by_name = user?.name || user?.email || 'Unknown User';
    } catch (error) {
      console.error('Error fetching user info:', error);
      hackathon.created_by_name = 'Unknown User';
    }
  }

  // Get user information if updated_by exists
  if (hackathon.updated_by) {
    try {
      const user = await getUserById(hackathon.updated_by);
      hackathon.updated_by_name = user?.name || user?.email || 'Unknown User';
    } catch (error) {
      console.error('Error fetching updated_by user info:', error);
      hackathon.updated_by_name = 'Unknown User';
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

  console.log("GET hackathons with options:", options);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  let filters: any = {};
  if (options.location) {
    filters.location = options.location;
    if (options.location == "InPerson") {
      filters = {
        NOT: {
          location: "Online",
        },
      };
    }
  }
  if (options.created_by) {
    // Show hackathons where user is either creator OR updater
    filters.OR = [
      { created_by: options.created_by },
      { updated_by: options.created_by }
    ];
  }
  if (options.date) filters.date = options.date;
  
  // Filter by visibility: only show public hackathons unless include_private is true
  if (!options.include_private) {
    filters.is_public = true;
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

    filters = {
      ...filters,
      OR: searchFilters,
    };
  }
  console.log("Filters: ", filters);

  const hackathonList = await prisma.hackathon.findMany({
    where: filters,
    skip: offset,
    take: pageSize,
    orderBy: {
      start_date: "desc",
    },
  });

  const hackathons = await Promise.all(hackathonList.map(getHackathonLite));
  let hackathonsLite = hackathons;

  if (options.status) {
    switch (options.status) {
      case "ENDED":
        hackathonsLite = hackathons.filter(
          (hackathon) => new Date(hackathon.end_date).getTime() < Date.now()
        );
        break;
      case "ONGOING":
        hackathonsLite = hackathons.filter(
          (hackathon) =>
            new Date(hackathon.start_date).getTime() <= Date.now() &&
            new Date(hackathon.end_date).getTime() >= Date.now()
        );
        break;
      case "UPCOMING":
        hackathonsLite = hackathons.filter(
          (hackathon) => new Date(hackathon.start_date).getTime() > Date.now()
        );
        break;
    }
  }

  const totalHackathons = await prisma.hackathon.count({
    where: filters,
  });

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
    total: totalHackathons,
    page,
    pageSize,
  };
}

export async function createHackathon(
  hackathonData: Partial<HackathonHeader>
): Promise<HackathonHeader> {
  const errors = validateHackathon(hackathonData);
  console.log(errors);
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors);
  }
  if (hackathonData.content?.schedule) {
    const schedule = hackathonData.content.schedule.map(
      (activity: ScheduleActivity) => {
        activity.date = getDateWithTimezone(
          activity.date,
          hackathonData.timezone ?? ""
        ).toISOString();
        return activity;
      }
    );
    hackathonData.content!.schedule = schedule;
  }
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
      participants: hackathonData.participants!,
      tags: hackathonData.tags!,
      timezone: hackathonData.timezone!,
      icon: hackathonData.icon!,
      banner: hackathonData.banner!,
      small_banner: hackathonData.small_banner!,
      top_most: hackathonData.top_most ?? false,
      content: content,
    },
  });
  hackathonData.id = newHackathon.id;
  revalidatePath("/api/hackathons/");
  return hackathonData as HackathonHeader;
}

export async function updateHackathon(
  id: string,
  hackathonData: Partial<HackathonHeader>,
  userId?: string
): Promise<HackathonHeader> {
  // Skip validation if we're only updating is_public field
  const isOnlyPublicUpdate = Object.keys(hackathonData).length === 1 && hackathonData.hasOwnProperty('is_public');
  
  if (!isOnlyPublicUpdate) {
    const errors = validateHackathon(hackathonData);
    console.log(errors);
    if (errors.length > 0) {
      throw new ValidationError("Validation failed", errors);
    }
  }

  const existingHackathon = await prisma.hackathon.findUnique({
    where: { id },
  });
  if (!existingHackathon) {
    throw new Error("Hackathon not found");
  }

  if (hackathonData.content?.schedule) {
    const schedule = hackathonData.content.schedule.map(
      (activity: ScheduleActivity) => {
        activity.date = getDateWithTimezone(
          activity.date,
          hackathonData.timezone ?? ""
        ).toISOString();
        return activity;
      }
    );
    hackathonData.content!.schedule = schedule;
  }
  // Build update data object with only provided fields
  const updateData: any = {};
  
  if (hackathonData.id !== undefined) updateData.id = hackathonData.id;
  if (hackathonData.title !== undefined) updateData.title = hackathonData.title;
  if (hackathonData.description !== undefined) updateData.description = hackathonData.description;
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
  if (hackathonData.location !== undefined) updateData.location = hackathonData.location;
  if (hackathonData.total_prizes !== undefined) updateData.total_prizes = hackathonData.total_prizes;
  if (hackathonData.tags !== undefined) updateData.tags = hackathonData.tags;
  if (hackathonData.timezone !== undefined) updateData.timezone = hackathonData.timezone;
  if (hackathonData.icon !== undefined) updateData.icon = hackathonData.icon;
  if (hackathonData.banner !== undefined) updateData.banner = hackathonData.banner;
  if (hackathonData.small_banner !== undefined) updateData.small_banner = hackathonData.small_banner;
  if (hackathonData.participants !== undefined) updateData.participants = hackathonData.participants;
  if (hackathonData.top_most !== undefined) updateData.top_most = hackathonData.top_most;
  if (hackathonData.organizers !== undefined) updateData.organizers = hackathonData.organizers;
  if (hackathonData.custom_link !== undefined) updateData.custom_link = hackathonData.custom_link;
  if (hackathonData.created_by !== undefined) updateData.created_by = hackathonData.created_by;
  if (hackathonData.is_public !== undefined) updateData.is_public = hackathonData.is_public;
  if (userId) updateData.updated_by = userId;
  if (hackathonData.content !== undefined) {
    const content = { ...hackathonData.content } as unknown as Prisma.JsonObject;
    updateData.content = content;
  }

  await prisma.hackathon.update({
    where: { id },
    data: updateData,
  });
  revalidatePath(`/api/hackathons/${hackathonData.id}`);
  revalidatePath("/api/hackathons/");
  return hackathonData as HackathonHeader;
}
