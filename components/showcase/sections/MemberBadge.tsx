"use client"
import { UserBadge } from '@/types/badge';
import { Member } from '@/types/showcase';
import Image from 'next/image';
import React, { useState } from 'react'

export default function MemberBadge({badges, member}: {badges: UserBadge[], member: Member}) {

  const badgesFiltered = badges?.filter((badge) => badge.user_id === member.user_id);
  const [showAll, setShowAll] = useState(false);
  const maxBadges = 12;

  const initialBadges = badgesFiltered?.slice(0, maxBadges) || [];
  const hasMore = badgesFiltered && badgesFiltered.length > maxBadges;
  const remainingCount = badgesFiltered ? badgesFiltered.length - maxBadges : 0;
  
  const displayBadges = showAll ? badgesFiltered : initialBadges;

  return (
    <>
      {badgesFiltered && badgesFiltered.length > 0 ? (
        <div className="flex flex-col gap-2 p-2">
          <h2 className="text-base text-center font-bold">Badges</h2>
          
          <div className="grid grid-cols-3 gap-1.5">
            {displayBadges.map((badge) => (
              
              <div 
                key={badge.badge_id} 
                className="flex items-center
              backdrop-blur-sm
          
                justify-center w-16 h-16 rounded-2xl  border  dark:border-gray-700 hover:scale-110 transition-transform duration-200 overflow-hidden"
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
          
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 self-start"
            >
              {showAll ? `Hide badges` : `Show ${remainingCount} badges more`}
            </button>
          )}
        </div>
      ) : (
        <div className="p-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">No badges</p>
        </div>
      )}
    </>
  )
}