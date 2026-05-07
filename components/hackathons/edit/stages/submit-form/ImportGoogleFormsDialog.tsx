'use client'

import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mapGoogleFormToSubmitFields, parseGoogleFormIdFromInput, type GoogleFormsGetResponse } from '@/lib/hackathons/map-google-form-to-submit-fields'
import { SubmitFormField } from '@/types/hackathon-stage'

const FORMS_SCOPE = 'https://www.googleapis.com/auth/forms.body.readonly'
type ImportDialogPhase = 'input' | 'confirmReplace' | 'fetching' | 'result'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingFieldsCount: number
  onImported: (fields: SubmitFormField[]) => void
}

export default function ImportGoogleFormsDialog({
  open,
  onOpenChange,
  existingFieldsCount,
  onImported,
}: Props): React.JSX.Element {
  const [importFormIdInput, setImportFormIdInput] = React.useState('')
  const [importPhase, setImportPhase] = React.useState<ImportDialogPhase>('input')
  const [importError, setImportError] = React.useState<string | null>(null)
  const [importWarnings, setImportWarnings] = React.useState<string[]>([])
  const [importedCount, setImportedCount] = React.useState<number | null>(null)

  const reset = (): void => {
    setImportFormIdInput('')
    setImportPhase('input')
    setImportError(null)
    setImportWarnings([])
    setImportedCount(null)
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      reset()
    }
  }

  const runGoogleFormsImport = async (): Promise<void> => {
    setImportPhase('fetching')
    setImportError(null)
    setImportWarnings([])
    setImportedCount(null)

    const parsedId = parseGoogleFormIdFromInput(importFormIdInput)
    if (!parsedId) {
      setImportError('Enter a valid form ID or a Google Forms URL that contains /forms/d/…')
      setImportPhase('result')
      return
    }

    try {
      const accessToken = await requestFormsAccessToken()
      const response = await fetch('/api/google-forms/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId: parsedId, accessToken }),
      })

      const payload: unknown = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof (payload as { error: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Could not load the form from Google.'
        setImportError(message)
        setImportPhase('result')
        return
      }

      const mapped = mapGoogleFormToSubmitFields(payload as GoogleFormsGetResponse)
      onImported(mapped.fields)
      setImportedCount(mapped.fields.length)
      setImportWarnings(mapped.warnings)
      setImportPhase('result')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed unexpectedly.')
      setImportPhase('result')
    }
  }

  const handleClickStartImport = (): void => {
    const parsedId = parseGoogleFormIdFromInput(importFormIdInput)
    if (!parsedId) {
      setImportError('Enter a valid form ID or a Google Forms URL that contains /forms/d/…')
      setImportPhase('result')
      return
    }
    setImportError(null)
    if (existingFieldsCount > 0) {
      setImportPhase('confirmReplace')
      return
    }
    void runGoogleFormsImport()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Google Forms</DialogTitle>
          <DialogDescription>
            Import the fields from your own form pasting the Google Form id or full link below.
            Unsupported fields will be skipped and you'll have to manually put the Link Field Type (if applicable).
          </DialogDescription>
        </DialogHeader>

        {importPhase === 'input' && (
          <div className="space-y-2">
            <Label htmlFor="google-form-id-input">Form ID or URL</Label>
            <Input
              id="google-form-id-input"
              value={importFormIdInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportFormIdInput(e.target.value)}
              placeholder="https://docs.google.com/forms/d/…/edit"
            />
          </div>
        )}

        {importPhase === 'confirmReplace' && (
          <Alert variant="warning">
            <AlertTitle>Replace existing fields?</AlertTitle>
            <AlertDescription>
              Importing will remove the {existingFieldsCount} field(s) already in this submit form and replace them
              with fields from Google Forms.
            </AlertDescription>
          </Alert>
        )}

        {importPhase === 'fetching' && (
          <p className="text-sm text-muted-foreground">
            Waiting for Google sign-in (if prompted) and loading the form…
          </p>
        )}

        {importPhase === 'result' && importError && (
          <Alert variant="destructive">
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
        )}

        {importPhase === 'result' && !importError && importedCount !== null && (
          <div className="space-y-3">
            <Alert>
              <AlertTitle>Import successful</AlertTitle>
              <AlertDescription>{importedCount} field(s) were added to this submit form.</AlertDescription>
            </Alert>
            {importWarnings.length > 0 && (
              <Alert variant="warning">
                <AlertTitle>Some items were skipped</AlertTitle>
                <AlertDescription>
                  <ul className="list-inside list-disc text-sm">
                    {importWarnings.map((warning: string, index: number) => (
                      <li key={`${index}-${warning.slice(0, 40)}`}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {importPhase === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleClickStartImport} disabled={!importFormIdInput.trim()}>
                Import
              </Button>
            </>
          )}
          {importPhase === 'confirmReplace' && (
            <>
              <Button type="button" variant="outline" onClick={() => setImportPhase('input')}>
                Back
              </Button>
              <Button type="button" onClick={() => void runGoogleFormsImport()}>
                Replace and import
              </Button>
            </>
          )}
          {importPhase === 'fetching' && (
            <Button type="button" variant="outline" disabled>
              Working…
            </Button>
          )}
          {importPhase === 'result' && (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in is only available in the browser.'))
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve()
  }

  const existing = document.querySelector('script[data-google-gsi="true"]') as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), {
        once: true,
      })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGsi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

function requestFormsAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) {
    return Promise.reject(
      new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Use the same Web client ID as GOOGLE_CLIENT_ID.')
    )
  }

  return loadGoogleIdentityScript().then(
    () =>
      new Promise((resolve, reject) => {
        const oauth2 = window.google?.accounts?.oauth2
        if (!oauth2) {
          reject(new Error('Google Identity Services did not initialize.'))
          return
        }

        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: FORMS_SCOPE,
          callback: (tokenResponse) => {
            if (tokenResponse.error) {
              reject(new Error(tokenResponse.error_description ?? tokenResponse.error ?? 'Google sign-in failed.'))
              return
            }
            if (!tokenResponse.access_token) {
              reject(new Error('No access token returned from Google.'))
              return
            }
            resolve(tokenResponse.access_token)
          },
        })

        client.requestAccessToken()
      })
  )
}
