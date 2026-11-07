import { RWA_FACILITIES } from './facilities'

export interface RWAPartner {
  name: string
  role: 'lender' | 'borrower' | 'protocol' | 'network'
  logo: string
  darkInvert?: boolean
}

export interface RWAProject {
  slug: string
  name: string
  description: string
  icon: string
  darkInvert?: boolean
  addresses: {
    tranchePool: string
  }
  partners: RWAPartner[]
}

const SHARED_ADDRESSES = {
  tranchePool: RWA_FACILITIES.oatfi.pool.address,
}

const SHARED_PARTNERS: RWAPartner[] = [
  { name: 'Avalanche', role: 'network', logo: '/avalanche-logo.svg' },
  { name: 'Valinor', role: 'lender', logo: '/rwa/valinor-logo.svg', darkInvert: true },
  { name: 'OatFi', role: 'borrower', logo: '/rwa/oatfi-logo.svg', darkInvert: true },
  { name: 'Fence', role: 'protocol', logo: '/rwa/fence-logo.png', darkInvert: true },
]

export const RWA_PROJECTS: Record<string, RWAProject> = {
  'valinor': {
    slug: 'valinor',
    name: 'Valinor',
    description: 'Institutional lender providing capital for real-world asset lending on Avalanche C-Chain through the Valinor-OatFi tranche pool.',
    icon: '/rwa/logos/valinor.svg',
    darkInvert: true,
    addresses: SHARED_ADDRESSES,
    partners: SHARED_PARTNERS,
  },
  'oatfi': {
    slug: 'oatfi',
    name: 'OatFi',
    description: 'Borrower protocol facilitating real-world asset lending on Avalanche C-Chain through the Valinor-OatFi tranche pool.',
    icon: '/rwa/logos/oatfi.svg',
    darkInvert: true,
    addresses: SHARED_ADDRESSES,
    partners: SHARED_PARTNERS,
  },
  'fence': {
    slug: 'fence',
    name: 'Fence',
    description: 'Protocol automating debt facility operations on Avalanche C-Chain through the Valinor-OatFi tranche pool.',
    icon: '/rwa/logos/fence_logo.jpeg',
    darkInvert: false,
    addresses: SHARED_ADDRESSES,
    partners: SHARED_PARTNERS,
  },
}

export function getRWAProject(slug: string): RWAProject | null {
  return RWA_PROJECTS[slug] ?? null
}

export function getAllRWAProjects(): RWAProject[] {
  return Object.values(RWA_PROJECTS)
}
