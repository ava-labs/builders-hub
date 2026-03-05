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
    borrower: string
    lenders: Record<string, string>
  }
  usdcTokens: string[]
  partners: RWAPartner[]
}

const SHARED_ADDRESSES = {
  tranchePool: '0xE25CB545Bdd47a8Ec2d08001cb5661B00D47621a',
  borrower: '0x41d9569610DaE2B6696797382fb26B5156Db426F',
  lenders: {
    Valinor: '0xE3cdE6F051872E67d0a7C2124E9A024D80E2733f',
    Avalanche: '0x7a75539cd0647625217EF93302855DDeB02F7093',
  },
}

const SHARED_USDC_TOKENS = [
  '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
]

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
    usdcTokens: SHARED_USDC_TOKENS,
    partners: SHARED_PARTNERS,
  },
  'oatfi': {
    slug: 'oatfi',
    name: 'OatFi',
    description: 'Borrower protocol facilitating real-world asset lending on Avalanche C-Chain through the Valinor-OatFi tranche pool.',
    icon: '/rwa/logos/oatfi.svg',
    darkInvert: true,
    addresses: SHARED_ADDRESSES,
    usdcTokens: SHARED_USDC_TOKENS,
    partners: SHARED_PARTNERS,
  },
  'fence': {
    slug: 'fence',
    name: 'Fence',
    description: 'Protocol automating debt facility operations on Avalanche C-Chain through the Valinor-OatFi tranche pool.',
    icon: '/rwa/logos/fence_logo.jpeg',
    darkInvert: false,
    addresses: SHARED_ADDRESSES,
    usdcTokens: SHARED_USDC_TOKENS,
    partners: SHARED_PARTNERS,
  },
}

export function getRWAProject(slug: string): RWAProject | null {
  return RWA_PROJECTS[slug] ?? null
}

export function getAllRWAProjects(): RWAProject[] {
  return Object.values(RWA_PROJECTS)
}
