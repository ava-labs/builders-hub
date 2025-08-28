"use client"
import { SessionProvider } from 'next-auth/react'
import React from 'react'
import { BadgeNotification } from './BadgeNotification'

export const AwardBadgeWrapper =  ({ courseId, isCompleted }: { courseId: string, isCompleted: boolean }) => {
    
  return (
    <SessionProvider>
        <BadgeNotification courseId={courseId} isCompleted={isCompleted} />
    </SessionProvider>
    
  )
}
