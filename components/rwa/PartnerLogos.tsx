'use client'

import Image from 'next/image'
import { AvalancheLogo } from '@/components/navigation/avalanche-logo'

const PARTNERS = [
  { name: 'Avalanche', logo: 'avalanche' as const },
  { name: 'Valinor', src: '/rwa/logos/valinor.svg', darkInvert: true },
  { name: 'OatFi', src: '/rwa/logos/oatfi.svg', darkInvert: true },
  { name: 'Fence', src: '/rwa/logos/fence.png', darkInvert: true, darkHueRotate: true },
]

export function PartnerLogos() {
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Partners
      </span>
      <div className="flex items-center gap-6">
        {PARTNERS.map((partner) =>
          partner.logo === 'avalanche' ? (
            <AvalancheLogo
              key={partner.name}
              className="h-6 w-6"
              aria-label={partner.name}
            />
          ) : (
            <Image
              key={partner.name}
              src={partner.src!}
              alt={partner.name}
              width={80}
              height={24}
              className={`h-6 w-auto object-contain ${partner.darkInvert ? 'dark:invert' : ''} ${partner.darkHueRotate ? 'dark:hue-rotate-180' : ''}`}
            />
          )
        )}
      </div>
    </div>
  )
}
