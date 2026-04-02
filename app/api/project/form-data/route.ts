import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';

type StageSubmitValues = Record<string, string | string[]>

type StageSubmitRequestBody = {
  hackathonId: string
  projectId?: string
  stageIndex: number
  values: StageSubmitValues
}

export const POST = withAuth(async (request: Request, _context, session) => {
  try {
    const body: StageSubmitRequestBody = await request.json()

    const hackathonId: string = body.hackathonId?.trim()
    const incomingProjectId: string = body.projectId?.trim() ?? ''
    const values: StageSubmitValues = body.values ?? {}

    if (!hackathonId) {
      return NextResponse.json(
        { error: 'hackathonId is required' },
        { status: 400 }
      )
    }

    const sessionUserId: string = session.user.id
    const sessionUserEmail: string = session.user.email ?? ''

    const result = await prisma.$transaction(async (tx) => {
      let resolvedProject:
        | {
            id: string
            project_name: string
          }
        | null = null

      if (incomingProjectId) {
        resolvedProject = await tx.project.findFirst({
          where: {
            id: incomingProjectId,
            hackaton_id: hackathonId,
            members: {
              some: {
                user_id: sessionUserId,
              },
            },
          },
          select: {
            id: true,
            project_name: true,
          },
        })
      }

      if (!resolvedProject) {
        resolvedProject = await tx.project.findFirst({
          where: {
            hackaton_id: hackathonId,
            members: {
              some: {
                user_id: sessionUserId,
              },
            },
          },
          select: {
            id: true,
            project_name: true,
          },
          orderBy: {
            created_at: 'desc',
          },
        })
      }

      if (!resolvedProject) {
        const dummyProject = await tx.project.create({
          data: {
            hackaton_id: hackathonId,
            project_name: `Draft Project ${new Date().toISOString()}`,
            short_description: 'Draft project created from stage submission',
            full_description: '',
            tech_stack: '',
            github_repository: '',
            demo_link: '',
            logo_url: '',
            cover_url: '',
            demo_video_link: '',
            screenshots: [],
            tracks: [],
            explanation: '',
            is_preexisting_idea: false,
            small_cover_url: '',
            tags: [],
            categories: [],
            origin: 'stage-submit',
            members: {
              create: {
                user_id: sessionUserId,
                email: sessionUserEmail,
                role: 'Owner',
                status: 'Confirmed',
              },
            },
          },
          select: {
            id: true,
            project_name: true,
          },
        })

        resolvedProject = dummyProject
      }

      const existingFormData = await tx.formData.findFirst({
        where: {
          project_id: resolvedProject.id,
        },
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          id: true,
          form_data: true,
        },
      })

      const mergedFormData: StageSubmitValues = {
        ...((existingFormData?.form_data as StageSubmitValues | null) ?? {}),
        ...values,
      }

      const savedFormData = existingFormData
        ? await tx.formData.update({
            where: {
              id: existingFormData.id,
            },
            data: {
              form_data: mergedFormData,
              timestamp: new Date(),
              origin: 'stage-submit',
            },
            select: {
              id: true,
              project_id: true,
            },
          })
        : await tx.formData.create({
            data: {
              project_id: resolvedProject.id,
              form_data: values,
              timestamp: new Date(),
              origin: 'stage-submit',
            },
            select: {
              id: true,
              project_id: true,
            },
          })

      return {
        projectId: resolvedProject.id,
        formDataId: savedFormData.id,
      }
    })

    return NextResponse.json(
      {
        success: true,
        projectId: result.projectId,
        formDataId: result.formDataId,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message: string =
      error instanceof Error ? error.message : 'Unknown error'

    console.error('Error POST /api/project/stage-submit:', error)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (request: Request, _context, session) => {
  try {
    const { searchParams } = new URL(request.url)

    const projectId: string = searchParams.get('projectId')?.trim() ?? ''

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    const sessionUserId: string = session.user.id

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        members: {
          some: {
            user_id: sessionUserId,
          },
        },
      },
      select: {
        id: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    const formData = await prisma.formData.findFirst({
      where: {
        project_id: projectId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        id: true,
        form_data: true,
        timestamp: true,
        origin: true,
        project_id: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        formData: formData ?? null,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message: string =
      error instanceof Error ? error.message : 'Unknown error'

    console.error('Error GET /api/project/form-data:', error)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})