export type Badge = {
    id: string
    name: string
    description: string
    points: number
    image_path: string
    category: string
    metadata: {
        [key: string]: string
    }
}

export type BadgeMetadata = {
    course_id: string,
    hackathon:'won' | 'register' | 'submission' | null
    type: 'course' | 'hackathon' 
}


export type UserBadge = {
    user_id: string
    badge_id: string
    name: string,
    description: string,
    image_path: string,
    category: string
}
