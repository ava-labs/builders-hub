export const ADDRESSES = {
  TRANCHE_POOL: '0xE25CB545Bdd47a8Ec2d08001cb5661B00D47621a',
  BORROWER_OPERATING: '0x41d9569610DaE2B6696797382fb26B5156Db426F',
  LENDER_VALINOR: '0xE3cdE6F051872E67d0a7C2124E9A024D80E2733f',
  LENDER_AVALANCHE: '0x7a75539cd0647625217EF93302855DDeB02F7093',
  USDC_NATIVE: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  USDC_BRIDGED: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
} as const

export const USDC_TOKENS = [
  ADDRESSES.USDC_NATIVE,
  ADDRESSES.USDC_BRIDGED,
] as const

export const USDC_DECIMALS = 6

export function normalizeAddress(address: string): string {
  return address.toLowerCase()
}

export function isInternalAddress(address: string): boolean {
  const normalized = normalizeAddress(address)
  return (
    normalized === normalizeAddress(ADDRESSES.TRANCHE_POOL) ||
    normalized === normalizeAddress(ADDRESSES.BORROWER_OPERATING)
  )
}

export const TRACKED_ADDRESSES = [
  ADDRESSES.TRANCHE_POOL,
  ADDRESSES.BORROWER_OPERATING,
  ADDRESSES.LENDER_VALINOR,
  ADDRESSES.LENDER_AVALANCHE,
] as const

export function isTrackedUsdcToken(tokenAddress: string): boolean {
  const normalized = normalizeAddress(tokenAddress)
  return USDC_TOKENS.some((token) => normalizeAddress(token) === normalized)
}
