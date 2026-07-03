'use client'

import * as React from 'react'

type UseProjectParams = {
  hackathonId: string
  userId: string
}

type Project = {
  id?: string
  team_name?: string
  [key: string]: any
} | null

type UseProjectResult = {
  project: Project
  projectId: string
  teamName: string
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useProjectByHackaUser({
  hackathonId,
  userId,
}: UseProjectParams): UseProjectResult {
  const [project, setProject] = React.useState<Project>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchProject = React.useCallback(async (): Promise<void> => {
    if (!hackathonId || !userId) {
      setProject(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response: Response = await fetch(
        `/api/project?hackathon_id=${encodeURIComponent(
          hackathonId
        )}&user_id=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch project (${response.status})`)
      }

      const data: { project: Project } = await response.json()
      console.log('Fetched project data:', data)

      setProject(data.project ?? null)
    } catch (err: unknown) {
      const message: string =
        err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setProject(null)
    } finally {
      setLoading(false)
    }
  }, [hackathonId, userId])

  React.useEffect((): void => {
    void fetchProject()
  }, [fetchProject])

  return {
    project,
    projectId: project?.id ?? '',
    teamName: project?.team_name ?? '',
    loading,
    error,
    refetch: fetchProject,
  }
}