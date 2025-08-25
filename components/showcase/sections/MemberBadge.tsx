import { UserBadge } from '@/types/badge';
import { Member } from '@/types/showcase';
import Image from 'next/image';
import React from 'react'

export default function MemberBadge({badges, member}: {badges: UserBadge[], member: Member}) {

  const badgesFiltered = badges?.filter((badge) => badge.user_id === member.user_id);

  return (
    <>
      {badgesFiltered && badgesFiltered.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 p-2">
          {badgesFiltered.map((badge) => (
            <div 
              key={badge.badge_id} 
              className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform duration-200 overflow-hidden"
              title={badge.name}
            >
              <Image
                src={badge.image_path}
                alt={badge.name + " icon"}
                width={64}
                height={64}
                className="object-cover w-full h-full"
                draggable={false}
                quality={90}
                priority={false}
                unoptimized={false}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">No badges</p>
        </div>
      )}
    </>
  )
}