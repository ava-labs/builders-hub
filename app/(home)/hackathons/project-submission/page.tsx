
import { SubmissionWrapperSecure } from '@/components/hackathons/project-submission/SubmissionWrapperSecure';
import UTMPreservationWrapper from "@/components/hackathons/UTMPreservationWrapper";
import React from 'react'

export default async function ProjectSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  
  const resolvedSearchParams = await searchParams;
  return (
    <UTMPreservationWrapper>
      <main className='container relative max-w-[1400px] py-4 lg:py-16 '>
        <div className='border border-zinc-300  dark:border-transparent shadow-sm dark:bg-zinc-950 bg-zinc-50 rounded-md'>
        <SubmissionWrapperSecure searchParams={resolvedSearchParams}/>
      </div>
      </main>
    </UTMPreservationWrapper>
  )
}
