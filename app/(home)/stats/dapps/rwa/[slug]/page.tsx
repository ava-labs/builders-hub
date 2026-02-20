'use client'

import { useParams, notFound } from 'next/navigation'
import { getRWAProject } from '@/lib/rwa/projects'
import { RWADashboard } from '@/components/rwa/RWADashboard'
import { StatsBubbleNav } from '@/components/stats/stats-bubble.config'

export default function RWAProjectPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const project = getRWAProject(slug)

  if (!project) {
    notFound()
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-full min-w-0">
        <RWADashboard slug={slug} />
      </div>
      <StatsBubbleNav />
    </div>
  )
}
