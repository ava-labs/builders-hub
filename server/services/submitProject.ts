import { hasAtLeastOne, requiredField, validateEntity, Validation } from './base';
import { revalidatePath } from 'next/cache';
import { ValidationError } from './hackathons';
import { prisma } from '@/prisma/prisma';
import { Project } from '@/types/project'; 
import { User } from '@prisma/client';

export const projectValidations: Validation[] = [
    {
        field: 'project_name',
        message: 'Project name is required.',
        validation: (project: Project) => requiredField(project, 'project_name')
    },
    {
        field: 'short_description',
        message: 'Short description is required.',
        validation: (project: Project) => requiredField(project, 'short_description')
    },
    {
        field: 'hackaton_id',
        message: 'Hackathon ID is required.',
        validation: (project: Project) => requiredField(project, 'hackaton_id')
    },
    {
        field: 'tracks',
        message: 'Please select at least one track.',
        validation: (project: Project) => hasAtLeastOne(project, 'tracks')
    },

];

export const validateProject = (projectData: Partial<Project>): Validation[] =>
    validateEntity(projectValidations, projectData);

export async function createProject(projectData: Partial<Project>): Promise<Project> {
    const isDraft = projectData.isDraft ?? false
    if (!isDraft) {
        const errors = validateProject(projectData);
        console.log("errors", errors)
        if (errors.length > 0) {
            throw new ValidationError('Project validation failed', errors);
        }
    }
    const existingProject = await prisma.project.findFirst({
        where: {
            hackaton_id: projectData.hackaton_id,
            members: {
                some: {
                    user_id: projectData.user_id,
                },
            },
        },
    });

    const newProjectData = await prisma.project.upsert({
        where: {
            id: existingProject?.id || '',
        },
        update: {
            project_name: projectData.project_name ?? "",
            short_description: projectData.short_description ?? "",
            full_description: projectData.full_description ?? "",
            tech_stack: projectData.tech_stack ?? "",
            github_repository: projectData.github_repository ?? "",
            demo_link: projectData.demo_link ?? "",
            explanation: projectData.explanation ?? "",
            is_preexisting_idea: projectData.is_preexisting_idea ?? false,
            logo_url: projectData.logo_url ?? "",
            cover_url: projectData.cover_url ?? "",
            demo_video_link: projectData.demo_video_link ?? "",
            screenshots: projectData.screenshots ?? [],
            tracks: projectData.tracks ?? [],
        },
        create: {
            hackathon: {
                connect: { id: projectData.hackaton_id },
            },
            project_name: projectData.project_name ?? "",
            short_description: projectData.short_description ?? "",
            full_description: projectData.full_description ?? "",
            tech_stack: projectData.tech_stack ?? "",
            github_repository: projectData.github_repository ?? "",
            demo_link: projectData.demo_link ?? "",
            is_preexisting_idea: projectData.is_preexisting_idea ?? false,
            logo_url: projectData.logo_url ?? "",
            cover_url: projectData.cover_url ?? "",
            demo_video_link: projectData.demo_video_link ?? "",
            screenshots: projectData.screenshots ?? [],
            tracks: projectData.tracks ?? [],
            explanation: projectData.explanation ?? "",
        },
    });

    await prisma.member.upsert({
        where: {
            user_id_project_id: {
                user_id: projectData.user_id!,
                project_id: newProjectData.id,
            },
        },
        update: {},
        create: {
            user_id: projectData.user_id as string,
            project_id: newProjectData.id,
            role: 'Member',
            status: 'Confirmed',
        },
    });
    projectData.id = newProjectData.id;
    revalidatePath('/api/projects/');
    return newProjectData as unknown as Project;
}


function normalizeUser(user: Partial<User>): User {
    return {
        id: user.id ?? '',
        name: user.name ?? null,
        email: user.email ?? null,
        telegram_user: user.telegram_user ?? null,
        image: user.image ?? null,
        authentication_mode: user.authentication_mode ?? null,
        integration: user.integration ?? null,
        last_login: user.last_login ?? null,
        notification_email: user.notification_email ?? null,
        user_name: user.user_name ?? null,
        custom_attributes: user.custom_attributes ?? [],
        bio: user.bio ?? null,
        profile_privacy: user.profile_privacy ?? null,
        social_media: user.social_media ?? [],
        notifications: user.notifications ?? true
     
    };
  }
export async function getProject(projectId: string): Promise<Project | null> {
    const projectData = await prisma.project.findUnique({
        where: {
            id: projectId,
        },
        include: {
            hackathon: true,
            members: {
                include: {
                    user: true
                }
            }
        }
    });

    if (!projectData) return null;


    const project: Project = {
        id: projectData.id,
        hackaton_id: projectData.hackaton_id,
        project_name: projectData.project_name,
        short_description: projectData.short_description,
        full_description: projectData.full_description ?? undefined,
        tech_stack: projectData.tech_stack ?? undefined,
        github_repository: projectData.github_repository ?? undefined,
        demo_link: projectData.demo_link ?? undefined,
        is_preexisting_idea: projectData.is_preexisting_idea,
        logo_url: projectData.logo_url ?? undefined,
        cover_url: projectData.cover_url ?? undefined,
        demo_video_link: projectData.demo_video_link ?? undefined,
        screenshots: projectData.screenshots ?? undefined,
        tracks: projectData.tracks,
        is_winner: false,

        members: projectData.members?.map(member => {
            const user = member.user
            return ({
                ...normalizeUser(member.user as Partial<User>),
                id:user?.id ?? "",
                name: user?.name ?? null,
                email: user?.email ?? null,
                telegram_user: user?.telegram_user ?? null,
                image: user?.image ?? null,
                custom_attributes: user?.custom_attributes ?? [],
                authentication_mode: user?.authentication_mode ?? "",
                role: member.role,
                status: member.status
            })
        })
    };

    return project;
}