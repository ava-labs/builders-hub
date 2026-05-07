import { redirect } from 'next/navigation'
import { getHackathon } from '@/server/services/hackathons'
import { getAuthSession } from '@/lib/auth/authSession'
import { getRegisterForm } from '@/server/services/registerForms'
import { getUserById } from '@/server/services/getUser'
import StageSubmitPageContent from '@/components/hackathons/project-submission/stages/submit-form/page-content'
import { ProjectSubmissionProvider } from '@/components/hackathons/project-submission/context/ProjectSubmissionContext'
import { useProjectByHackaUser } from '@/hooks/use-get-project-hacka-user'

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

  let isRegistered: boolean = false
  const session = await getAuthSession()

  if (session?.user?.email) {
    const registration = await getRegisterForm(session.user.email, id)
    isRegistered = !!registration
  }

  const stages = hackathon.content.stages ?? []
  const stage = stages[stageIndex]

  if (!stage) {
    redirect(`/hackathons/${id}`)
  }

  const hackathonCreator = await getUserById(hackathon.created_by)

  return (
    <ProjectSubmissionProvider>
      <main className="container py-4 sm:px-2 lg:py-16">
        <div className="mt-8 px-4">
          <StageSubmitPageContent
            hackathon={hackathon}
            hackathonCreator={hackathonCreator}
            stage={stage}
            stageIndex={stageIndex}
            user={session?.user}
          />
        </div>
      </main>
    </ProjectSubmissionProvider>
  )
}