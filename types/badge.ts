export enum BadgeAwardStatus {
    pending,
    approved,
    revoked
  }
  
export type Requirement = {
    id: string
    course_id?: string,
    hackathon?: 'won' | 'register' | 'submission' | null
    type?: 'course' | 'hackathon' 
    points?: number
    description?: string
    unlocked: boolean
   
}

export type Badge = {
    id: string
    name: string
    description: string
    points?: number
    image_path: string
    category: string
    requirements?: Requirement[]
    is_unlocked?: boolean
}

export type UserBadge = {
    user_id: string
    badge_id: string
    awarded_at: Date
    awarded_by: string | null
    name: string
    description: string
    // points: number // COMMENTED OUT: Points feature disabled
    image_path: string
    category: string
    requirements: Requirement[] | null
    status?: BadgeAwardStatus
    requirements_version?: number
    evidence?: Requirement[]
}

export type ProjectBadge={
    id: string
    project_id: string
    badge_id: string
    awarded_at: Date
    awarded_by: string | null
    status: BadgeAwardStatus
    requirements_version: number
    name: string
    image_path: string
    evidence: Requirement[]
}
