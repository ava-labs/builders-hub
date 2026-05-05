'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { AvalancheLogo } from '@/components/navigation/avalanche-logo'

const PARTNERS = [
  { name: 'Avalanche', logo: 'avalanche' as const },
  { name: 'Valinor', src: '/rwa/logos/valinor-wordmark.svg', darkInvert: true },
  { name: 'OatFi', src: '/rwa/logos/oatfi-wordmark.svg', darkInvert: true },
  { name: 'Fence', src: '/rwa/logos/fence.png', darkInvert: true },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

const logoItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 0.7,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

export function PartnerLogos() {
  return (
    <motion.div
      className="flex items-center gap-2 sm:gap-6 flex-wrap"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      <motion.span
        variants={itemVariants}
        className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
      >
        Partners
      </motion.span>
      <motion.div className="flex items-center gap-2 sm:gap-6 flex-wrap" variants={containerVariants}>
        {PARTNERS.map((partner) => (
          <motion.div
            key={partner.name}
            variants={logoItemVariants}
            whileHover={{
              opacity: 1,
              y: -2,
              scale: 1.05,
              filter: 'drop-shadow(0 0 8px rgba(100, 100, 100, 0.3))',
              transition: { type: 'spring', stiffness: 300, damping: 20 },
            }}
            className="cursor-default"
          >
            {partner.logo === 'avalanche' ? (
              <AvalancheLogo
                className="h-6 w-6"
                aria-label={partner.name}
              />
            ) : (
              <Image
                src={partner.src!}
                alt={partner.name}
                width={80}
                height={24}
                unoptimized={partner.src?.endsWith('.svg')}
                className={`h-6 w-auto object-contain ${partner.darkInvert ? 'dark:invert dark:hue-rotate-180' : ''}`}
              />
            )}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}
