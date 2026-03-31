import { redirect } from 'next/navigation'
import { getHackathon } from '@/server/services/hackathons'
import { getAuthSession } from '@/lib/auth/authSession'
import { getRegisterForm } from '@/server/services/registerForms'
import { getUserById } from '@/server/services/getUser'
import StageSubmitPageContent from '@/components/hackathons/project-submission/stages/submit-form/page-content'
import { ProjectSubmissionProvider } from '@/components/hackathons/project-submission/context/ProjectSubmissionContext'

type SubmitPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function HackathonSubmitPage({
  params,
  searchParams,
}: SubmitPageProps): Promise<React.JSX.Element> {
  const { id } = await params
  const resolvedSearchParams = await searchParams

  const stageParam: string =
    typeof resolvedSearchParams.stage === 'string'
      ? resolvedSearchParams.stage
      : '0'

  const stageIndex: number = Number(stageParam)

  const hackathon = await getHackathon(id)

  if (!hackathon) {
    redirect('/hackathons')
  }

  const session = await getAuthSession()
  let isRegistered: boolean = false

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
            onSubmit={async (payload) => {
              'use server'
              console.log(payload)
            }}
          />
        </div>
      </main>
    </ProjectSubmissionProvider>
  )
}