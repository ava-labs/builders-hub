import { redirect } from 'next/navigation'

const AmbasssadorDaoAllJobsPage = () => {
  redirect('/ambassador-dao?type=jobs')
  return (
    <div></div>
  )
}

export default AmbasssadorDaoAllJobsPage
