import { Hackathon, HackathonHeader, HackathonStatus } from "@/types/hackathons";
import { hasAtLeastOne, requiredField, validateEntity, Validation } from "./base";
import { Prisma, PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();


export const hackathonsValidations: Validation[] = [
    { field: "title", message: "Please provide a title for the hackathon.", validation: (hackathon: Hackathon) => requiredField(hackathon, "title") },
    { field: "description", message: "A description is required.", validation: (hackathon: Hackathon) => requiredField(hackathon, "description") },
    { field: "start_date", message: "Please enter a valid date for the hackathon.", validation: (hackathon: Hackathon) => requiredField(hackathon, "start_date") },
    { field: "end_date", message: "Please enter a valid end date for the hackathon.", validation: (hackathon: Hackathon) => requiredField(hackathon, "end_date") },
    { field: "location", message: "Please specify the location of the hackathon.", validation: (hackathon: Hackathon) => requiredField(hackathon, "location") },
    { field: "tags", message: "Please add at least one category or tag.", validation: (hackathon: Hackathon) => hasAtLeastOne(hackathon, "tags") }
];

export const validateHackathon = (hackathon: Partial<HackathonHeader>): Validation[] => validateEntity(hackathonsValidations, hackathon);

export class ValidationError extends Error {
    public details: Validation[];
    public cause: string;

    constructor(message: string, details: Validation[]) {
        super(message);
        this.cause = "ValidationError";
        this.details = details;
    }
}





export function getHackathonLite(hackathon: any): HackathonHeader {
    delete hackathon.content
    return hackathon;
}

export interface GetHackathonsOptions {
    page?: number;
    pageSize?: number;
    location?: string | null;
    date?: string | null;
    status?: HackathonStatus | null;
    search?: string;
}

export async function getHackathon(id: string) {

    const hackathon = await prisma.hackathon.findUnique({
        where: { id },
    });
    if (!hackathon)
        throw new Error("Hackathon not found", { cause: "BadRequest" });

    const hackathonContent = hackathon.content as unknown as Hackathon
    return {
        ...hackathon,
        content: hackathonContent,
        status: getStatus(hackathon.start_date, hackathon.end_date)
    } as HackathonHeader
}

const getStatus = (start_date: Date, end_date: Date) => {

    if (start_date.getTime() <= Date.now() && end_date.getTime() >= Date.now())
        return "ONGOING"
    if (start_date.getTime() > Date.now())
        return "UPCOMING"
    else
        return "ENDED"
}

export async function getFilteredHackathons(options: GetHackathonsOptions) {

    if (options.page && options.page < 1 || options.pageSize && options.pageSize < 1)
        throw new Error("Pagination params invalid", { cause: "BadRequest" });

    console.log('GET hackathons with options:', options);
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    let filters: any = {};
    if (options.location) {
        filters.location = options.location;
        if (options.location == 'InPerson') {
            filters = {
                NOT: {
                    location: 'Online'
                },
            }
        }
    }
    if (options.date) filters.date = options.date;
    if (options.search) {
        const searchWords = options.search.split(/\s+/)
        let searchFilters: any[] = []
        searchWords.forEach((word) => {
            searchFilters = [...searchFilters,
            {
                title: {
                    contains: word, mode: "insensitive",
                },
            },
            {
                location: {
                    contains: word, mode: "insensitive"
                },
            },
            {
                description: {
                    contains: word, mode: "insensitive"
                },
            },
            ]
        })
        searchFilters = [...searchFilters,
        {
            tags: {
                has: options.search
            },
        },
        ]

        filters = {
            ...filters,
            OR: searchFilters
        }
    }
    console.log('Filters: ', filters)

    const hackathonList = await prisma.hackathon.findMany({
        where: filters,
        skip: offset,
        take: pageSize,
    });

    const hackathons = hackathonList.map(getHackathonLite);
    let hackathonsLite = hackathons

    if (options.status) {
        switch (options.status) {
            case "UPCOMING":
                hackathonsLite = hackathons.filter(hackathon => hackathon.start_date.getTime() > Date.now());
                break;
            case "ONGOING":
                hackathonsLite = hackathons.filter(hackathon => hackathon.start_date.getTime() <= Date.now() && hackathon.end_date.getTime() >= Date.now());
                break;
            case "ENDED":
                hackathonsLite = hackathons.filter(hackathon => hackathon.end_date.getTime() < Date.now());
                break;
        }
    }

    const totalHackathons = await prisma.hackathon.count({
        where: filters,
    });

    return {
        hackathons: hackathonsLite.map((hackathon) => ({
            ...hackathon,
            status: getStatus(hackathon.start_date, hackathon.end_date)
        } as HackathonHeader)),
        total: totalHackathons,
        page,
        pageSize,
    };
}


export async function createHackathon(hackathonData: Partial<HackathonHeader>): Promise<HackathonHeader> {
    const errors = validateHackathon(hackathonData);
    console.log(errors)
    if (errors.length > 0) {
        throw new ValidationError("Validation failed", errors)
    }

    const content = { ...hackathonData.content } as Prisma.JsonObject
    const newHackathon = await prisma.hackathon.create({
        data: {
            id: hackathonData.id,
            title: hackathonData.title!,
            description: hackathonData.description!,
            start_date: hackathonData.start_date!,
            end_date: hackathonData.end_date!,
            location: hackathonData.location!,
            total_prizes: hackathonData.total_prizes!,
            participants: hackathonData.participants!,
            tags: hackathonData.tags!,
            timezone: hackathonData.timezone!,
            icon: hackathonData.icon!,
            banner: hackathonData.banner!,
            small_banner: hackathonData.small_banner!,
            content: content
        },
    });
    hackathonData.id = newHackathon.id;
    revalidatePath('/api/hackathons/')
    return hackathonData as HackathonHeader;
}


export async function updateHackathon(id: string, hackathonData: Partial<HackathonHeader>): Promise<HackathonHeader> {
    const errors = validateHackathon(hackathonData);
    console.log(errors)
    if (errors.length > 0) {
        throw new ValidationError("Validation failed", errors)
    }

    const existingHackathon = await prisma.hackathon.findUnique({
        where: { id },
    });
    if (!existingHackathon) {
        throw new Error("Hackathon not found")
    }

    const content = { ...hackathonData.content } as Prisma.JsonObject
    await prisma.hackathon.update({
        where: { id },
        data: {
            id: hackathonData.id,
            title: hackathonData.title!,
            description: hackathonData.description!,
            start_date: hackathonData.start_date!,
            end_date: hackathonData.end_date!,
            location: hackathonData.location!,
            total_prizes: hackathonData.total_prizes!,
            tags: hackathonData.tags!,
            timezone: hackathonData.timezone!,
            icon: hackathonData.icon!,
            banner: hackathonData.banner!,
            small_banner: hackathonData.small_banner!,
            content: content

        },
    });
    revalidatePath(`/api/hackathons/${hackathonData.id}`)
    revalidatePath('/api/hackathons/')
    return hackathonData as HackathonHeader;
}