import { redirect } from 'next/navigation'
import { getHackathon } from '@/server/services/hackathons'
import { getAuthSession } from '@/lib/auth/authSession'
import { getRegisterForm } from '@/server/services/registerForms'
import { getUserById } from '@/server/services/getUser'
import StageSubmitAccordionView from '@/components/hackathons/project-submission/stages/submit-form/StageSubmitAccordionView'
import { ProjectSubmissionProvider } from '@/components/hackathons/project-submission/context/ProjectSubmissionContext'

type SubmitPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function HackathonSubmitPage({
  params,
  searchParams,
}: SubmitPageProps): Promise<React.JSX.Element> {
  function parseStage(value: unknown): number {
    if (typeof value !== 'string') return 0
    if (!/^(0|[1-9]\d*)$/.test(value)) return 0
    return parseInt(value, 10)
  }
  const { id } = await params
  const resolvedSearchParams = await searchParams

  const stageIndex = parseStage(resolvedSearchParams.stage)

  const hackathon = await getHackathon(id)

  if (!hackathon) {
    redirect('/hackathons')
  }

  const session = await getAuthSession()

  // Submitting a project requires an authenticated user (project ownership,
  // file uploads and the form-data API all need a session). Without this gate
  // a logged-out visitor could open the form and only hit an opaque 401 when
  // uploading or saving. Send them to login and back here afterwards.
  if (!session?.user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/hackathons/${id}/stage-form?stage=${stageIndex}`)}`
    )
  }

  let isRegistered: boolean = false

  if (session.user.email) {
    const registration = await getRegisterForm(session.user.email, id)
    isRegistered = !!registration
  }

  const stages = hackathon.content.stages ?? []

  if (stages.length === 0) {
    redirect(`/hackathons/${id}`)
  }

  const hackathonCreator = await getUserById(hackathon.created_by)

  return (
    <ProjectSubmissionProvider>
      <main className="container py-4 sm:px-2 lg:py-16">
        <div className="mt-8 px-4">
          <StageSubmitAccordionView
            hackathon={hackathon}
            hackathonCreator={hackathonCreator}
            stages={stages}
            initialStageIndex={stageIndex}
            user={session?.user}
          />
        </div>
      </main>
    </ProjectSubmissionProvider>
  )
}