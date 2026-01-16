import { prisma } from "@/prisma/prisma";
import { Prisma } from "@prisma/client";

import ExcelJS from 'exceljs';

interface ProjectExport {
    project_name: string;
    short_description: string;
    full_description: string;
    tech_stack: string;
    github_repository: string;
    demo_link: string;
    demo_video_link: string;
    tracks: string;
    tags: string;
    members: string;
    prizes: string;
    hackathon: string;
}

type ExportShowcaseFilters = {
    event?: string;
    track?: string;
    search?: string;
    winningProjects?: boolean;
};

export async function exportShowcase(rawFilters: unknown) {
    const filters = normalizeFilters(rawFilters);
    const where = buildProjectWhere(filters);

    const projects = await prisma.project.findMany({
        include: {
            members: true,
            hackathon: true,
            prizes: true,
        },
        where,
    });

    if (!projects.length) {
        return null;
    }

    const projectsExport: ProjectExport[] = projects.map((project) => ({
        project_name: project.project_name,
        short_description: project.short_description,
        full_description: project.full_description ?? '',
        tech_stack: project.tech_stack ?? '',
        github_repository: project.github_repository ?? '',
        demo_link: project.demo_link ?? '',
        demo_video_link: project.demo_video_link ?? '',
        tracks: (project.tracks ?? []).join(', '),
        tags: (project.tags ?? []).join(', '),
        members: project.members
            .map((member) => member.email ?? member.user_id ?? '')
            .filter(Boolean)
            .join(', '),
        prizes: project.prizes.map((prize) => prize.prize).join(', '),
        hackathon: project.hackathon?.title ?? '',
    }));
    const buffer = await createWorkbook(projectsExport);
    return buffer;
}

function normalizeFilters(body: unknown): ExportShowcaseFilters {
    if (!body || typeof body !== 'object') {
        return {};
    }

    const filters = body as Record<string, unknown>;

    return {
        event: typeof filters.event === 'string' ? filters.event : undefined,
        track: typeof filters.track === 'string' ? filters.track : undefined,
        search: typeof filters.search === 'string' ? filters.search : undefined,
        winningProjects: parseBoolean(filters.winningProjects ?? filters.winningProjecs),
    };
}

function parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        const lowered = value.trim().toLowerCase();
        if (lowered === 'true') {
            return true;
        }
        if (lowered === 'false') {
            return false;
        }
    }

    return undefined;
}

function buildProjectWhere(filters: ExportShowcaseFilters): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = {};

    if (filters.event) {
        where.hackaton_id = filters.event;
    }

    if (filters.track) {
        where.tracks = {
            has: filters.track,
        };
    }

    if (filters.winningProjects) {
        where.is_winner = true;
    }

    if (filters.search) {
        const searchTerms = filters.search
            .split(/\s+/)
            .map((term) => term.trim())
            .filter((term) => term.length > 0);

        if (searchTerms.length > 0) {
            const orConditions: Prisma.ProjectWhereInput[] = [];

            searchTerms.forEach((term) => {
                orConditions.push(
                    {
                        project_name: {
                            contains: term,
                            mode: 'insensitive',
                        },
                    },
                    {
                        full_description: {
                            contains: term,
                            mode: 'insensitive',
                        },
                    }
                );
            });

            orConditions.push({
                tracks: {
                    has: filters.search,
                },
            });

            where.OR = orConditions;
        }
    }

    return where;
}

 async function createWorkbook(projects: ProjectExport[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Projects');
    worksheet.columns = [
        { header: 'Project Name', key: 'project_name', width: 25 },
        { header: 'Short Description', key: 'short_description', width: 35 },
        { header: 'Full Description', key: 'full_description', width: 50 },
        { header: 'Tech Stack', key: 'tech_stack', width: 30 },
        { header: 'Github Repository', key: 'github_repository', width: 40 },
        { header: 'Demo Link', key: 'demo_link', width: 40 },
        { header: 'Demo Video Link', key: 'demo_video_link', width: 40 },
        { header: 'Tracks', key: 'tracks', width: 25 },
        { header: 'Tags', key: 'tags', width: 25 },
        { header: 'Members', key: 'members', width: 35 },
        { header: 'Prizes', key: 'prizes', width: 30 },
        { header: 'Hackathon', key: 'hackathon', width: 25 },
    ];

    projects.forEach(project => {
        worksheet.addRow({
            project_name: project.project_name,
            short_description: project.short_description,
            full_description: project.full_description,
            tech_stack: project.tech_stack,
            github_repository: project.github_repository,
            demo_link: project.demo_link,
            demo_video_link: project.demo_video_link,
            tracks: project.tracks,
            tags: project.tags,
            members: project.members,
            prizes: project.prizes,
            hackathon: project.hackathon,
        });
    });
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF4444' }
        };
        cell.font = {
            name: 'Arial',
            size: 11,
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: false
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
    });

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.eachCell((cell) => {
                cell.alignment = {
                    vertical: 'top',
                    horizontal: 'left',
                    wrapText: true
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            });
            
            if (rowNumber % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF9FAFB' }
                    };
                });
            }
        }
    });

    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length }
    };

    worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;    
}