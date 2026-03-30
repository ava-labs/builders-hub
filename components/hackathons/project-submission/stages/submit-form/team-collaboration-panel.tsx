'use client'

import React from 'react'
import { X, Users, Mail, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type TeamRole = 'Owner' | 'Member'

type TeamMember = {
  id: string
  name: string
  email: string
  role: TeamRole
  status: 'Confirmed' | 'Pending'
  isCurrentUser: boolean
}

type TeamCollaborationPanelProps = {
  hackathonTitle: string
  currentUserName: string
  currentUserEmail: string
}

function buildInitialMembers(
  currentUserName: string,
  currentUserEmail: string
): TeamMember[] {
  if (!currentUserEmail.trim()) {
    return []
  }

  return [
    {
      id: 'current-user',
      name: currentUserName.trim() || currentUserEmail,
      email: currentUserEmail,
      role: 'Owner',
      status: 'Confirmed',
      isCurrentUser: true,
    },
  ]
}

function isValidEmail(email: string): boolean {
  const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function buildDisplayName(email: string): string {
  const [localPart] = email.split('@')
  return localPart || email
}

export default function TeamCollaborationPanel({
  hackathonTitle,
  currentUserName,
  currentUserEmail,
}: TeamCollaborationPanelProps): React.JSX.Element {
  const [members, setMembers] = React.useState<TeamMember[]>(
    buildInitialMembers(currentUserName, currentUserEmail)
  )
  const [draftEmail, setDraftEmail] = React.useState<string>('')
  const [errorMessage, setErrorMessage] = React.useState<string>('')

  const handleAddMember = (): void => {
    const trimmedEmail: string = draftEmail.trim().toLowerCase()

    if (!trimmedEmail) {
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    const alreadyExists: boolean = members.some(
      (member: TeamMember): boolean => member.email.toLowerCase() === trimmedEmail
    )

    if (alreadyExists) {
      setErrorMessage('That email is already in the team list.')
      return
    }

    const nextMember: TeamMember = {
      id: `local-${trimmedEmail}`,
      name: buildDisplayName(trimmedEmail),
      email: trimmedEmail,
      role: 'Member',
      status: 'Pending',
      isCurrentUser: false,
    }

    setMembers((previousMembers: TeamMember[]): TeamMember[] => {
      return [...previousMembers, nextMember]
    })

    setDraftEmail('')
    setErrorMessage('')
  }

  const handleRemoveMember = (memberId: string): void => {
    setMembers((previousMembers: TeamMember[]): TeamMember[] => {
      return previousMembers.filter(
        (member: TeamMember): boolean => member.id !== memberId
      )
    })
  }

  return (
    <div className="space-y-5">
      <Card className="border border-[#d66666]/20 bg-[#0b0b0f] p-5 text-white">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-[#d66666]/15 p-2">
            <Info className="h-4 w-4 text-[#d66666]" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-white">
              Team setup for {hackathonTitle}
            </p>
            <p className="text-sm text-zinc-400">
              You do not have a project yet. Members added here are local for now
              and can later be connected to a real project.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border border-[#d66666]/20 bg-[#0b0b0f] p-5 text-white">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#d66666]" />
          <h4 className="text-base font-semibold">Invite collaborators</h4>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            value={draftEmail}
            onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
              setDraftEmail(event.target.value)
              if (errorMessage) {
                setErrorMessage('')
              }
            }}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>): void => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddMember()
              }
            }}
            placeholder="Add teammate email"
            className="border-zinc-700 bg-zinc-900/80 text-white placeholder:text-zinc-500 focus:border-[#d66666]"
          />

          <Button
            type="button"
            onClick={handleAddMember}
            className="bg-[#d66666] text-zinc-900 hover:bg-[#e57f7f]"
          >
            Add member
          </Button>
        </div>

        {errorMessage ? (
          <p className="mt-3 text-sm text-[#ff8a8a]">{errorMessage}</p>
        ) : null}
      </Card>

      <Card className="border border-[#d66666]/20 bg-[#0b0b0f] p-5 text-white">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-[#d66666]" />
          <h4 className="text-base font-semibold">Current team</h4>
        </div>

        {!members.length ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-400">
            No team members yet.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member: TeamMember): React.JSX.Element => {
              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{member.name}</p>

                      <span className="rounded-full border border-[#d66666]/25 bg-[#d66666]/10 px-2 py-0.5 text-xs text-[#ff8a8a]">
                        {member.role}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-300">
                        {member.status}
                      </span>
                    </div>

                    <p className="mt-1 break-all text-sm text-zinc-400">
                      {member.email}
                    </p>
                  </div>

                  {!member.isCurrentUser ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(): void => handleRemoveMember(member.id)}
                      className="h-9 w-9 p-0 text-zinc-400 hover:bg-transparent hover:text-[#d66666]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}