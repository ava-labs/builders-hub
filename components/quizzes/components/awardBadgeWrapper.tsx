"use client"
import React from 'react'
import { BadgeNotification } from './BadgeNotification'

export const AwardBadgeWrapper = ({ courseId, isCompleted }: { courseId: string, isCompleted: boolean }) => {
  return <BadgeNotification courseId={courseId} isCompleted={isCompleted} />;
}
