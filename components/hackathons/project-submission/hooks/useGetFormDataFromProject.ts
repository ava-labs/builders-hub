'use client'

import * as React from 'react'

type StageSubmitValues = Record<string, string | string[]>

type UseProjectFormDataParams = {
  projectId: string
}

type UseProjectFormDataResult = {
  formData: StageSubmitValues | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useProjectFormData({
  projectId,
}: UseProjectFormDataParams): UseProjectFormDataResult {
  const [formData, setFormData] = React.useState<StageSubmitValues | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchFormData = React.useCallback(async (): Promise<void> => {
    if (!projectId) {
      setFormData(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response: Response = await fetch(
        `/api/project/form-data?projectId=${encodeURIComponent(projectId)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      )

      const data: {
        success?: boolean
        error?: string
        formData?: {
          form_data: StageSubmitValues
        } | null
      } = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch form data')
      }

      setFormData(data.formData?.form_data ?? null)
    } catch (err: unknown) {
      const message: string =
        err instanceof Error ? err.message : 'Unknown error'

      setError(message)
      setFormData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void fetchFormData()
  }, [fetchFormData])

  return {
    formData,
    loading,
    error,
    refetch: fetchFormData,
  }
}