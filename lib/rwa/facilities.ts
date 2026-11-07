export interface RWALine {
  /** the lender's position in the line: a Credit Position Token id, not an index */
  positionId: number
  /** the block the line was created in: none of its events is older */
  fromBlock: number
  /** Credit Coop's lockbox, which pays the borrower's revenue into the line: the payer of every repayment so far */
  spigot: { address: string; label: string }
}

export interface RWAFacility {
  /** the facility's id in URLs and cache keys */
  slug: string
  /** the contract that holds the facility's capital */
  pool: { address: string; label: string }
  /** the wallet that receives the draws */
  borrower: { address: string; label: string; partner: string }
  /** the lender-side senders into the pool */
  lenders: { address: string; partner: string }[]
  usdcTokens: readonly string[]
  features: { fence: boolean }
  /** a Credit Coop line of credit: its figures come from the position's events and the position itself, not from USDC transfers */
  line?: RWALine
}

export type LineFacility = RWAFacility & { line: RWALine }

/** whether the facility is a Credit Coop line of credit */
export function isLineFacility(facility: RWAFacility): facility is LineFacility {
  return facility.line !== undefined
}

/** every facility the RWA view serves, by slug */
export const RWA_FACILITIES: Record<string, RWAFacility> = {
  oatfi: {
    slug: 'oatfi',
    pool: { address: '0xE25CB545Bdd47a8Ec2d08001cb5661B00D47621a', label: 'Tranche Pool' },
    borrower: { address: '0x41d9569610DaE2B6696797382fb26B5156Db426F', label: 'Borrower Operating', partner: 'OatFi' },
    lenders: [
      { address: '0xE3cdE6F051872E67d0a7C2124E9A024D80E2733f', partner: 'Valinor' },
      { address: '0x7a75539cd0647625217EF93302855DDeB02F7093', partner: 'Avalanche' },
    ],
    // native USDC, then bridged USDC.e: same-time ledger rows and the lender breakdown follow this order
    usdcTokens: ['0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664'],
    features: { fence: true },
  },
  rain: {
    slug: 'rain',
    pool: { address: '0x3042f180826f4D16cFD28296f6362760105b2b94', label: 'Line of credit' },
    // the wallet that receives every draw on position 3; the line's borrower() is a separate Safe (0xC86A35ceB3eFA7BDdB5F15844AC0d3A62370ABaD)
    borrower: { address: '0xae51564961886aee70941d69a4f5968c96007200', label: 'Rain', partner: 'Rain' },
    // the credit strategy of the Valinor Credit Vault (0xc6df254f147dac8e0a891558e8e5d788a8c871be): it holds the position token, so it is the lender of record
    lenders: [{ address: '0x41640a4a2ec0caa60ab1f57cd4c614485057af4d', partner: 'Valinor' }],
    usdcTokens: ['0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'],
    features: { fence: false },
    line: {
      positionId: 3,
      fromBlock: 74_018_962,
      spigot: { address: '0x0AE1D18e2f23D32a7e44c45984f3505f9f81d04c', label: 'Spigot' },
    },
  },
}

/** the partner slugs that named OatFi's facility before there was a second one */
const LEGACY_SLUGS = new Map([
  ['valinor', 'oatfi'],
  ['fence', 'oatfi'],
])

/** a facility by its slug; the old partner slugs valinor and fence name OatFi's */
export function getFacility(slug: string): RWAFacility | null {
  const facilitySlug = LEGACY_SLUGS.get(slug) ?? slug
  // own keys only: a slug such as constructor names no facility
  return Object.hasOwn(RWA_FACILITIES, facilitySlug) ? RWA_FACILITIES[facilitySlug] : null
}
