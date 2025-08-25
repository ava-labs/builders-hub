import { UserBadge } from '@/types/badge';
import { Member } from '@/types/showcase';
import Image from 'next/image';
import React from 'react'

export default function MemberBadge({badges, member}: {badges: UserBadge[], member: Member}) {

  console.log("badges", badges);
  console.log("member", member);
  const badgesFiltered = badges?.filter((badge) => badge.user_id === member.user_id);
  console.log("badgesFiltered", badgesFiltered);
  return (
    <>
      {badgesFiltered && badgesFiltered.length > 0 ? (
        <div>
          {badgesFiltered.map((badge) => (
            <div key={badge.badge_id}>
                <Image
                    src={badge.image_path}
                    alt={badge.name + " icon"}
                    width={128}
                    height={128}
                    className="object-contain w-full h-full"
                    draggable={false}
                    quality={90}
                    priority={false}
                    unoptimized={false}
                  />
                  <p>{badge.name}</p>
            </div>
        ))}
    </div>
    ) : (
        <div>
            <p>User has no badges</p>
        </div>
    )}
    </>
  )
}