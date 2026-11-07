import 'server-only'
import { createPublicClient, encodeFunctionData, getAddress, hexToBigInt, http, parseAbi, size, slice, type PublicClient } from 'viem'
import { avalanche } from 'viem/chains'
import { chainRpc } from '@/lib/explorer-query/head'
import type { LineFacility } from '../facilities'
import { CacheKeys, readThrough } from '../glacier/cache'

/** a position as the line reads it now */
export interface CreditPosition {
  deposit: bigint     // the capital committed to the position
  principal: bigint   // the principal drawn and not yet repaid
}

const LINE_ABI = parseAbi(['function getCreditPosition(uint256 tokenId) view'])
/** the Credit struct of Credit Coop's ILineOfCredit.sol, as getCreditPosition returns it: 11 words */
const CREDIT_BYTES = 11 * 32

let client: PublicClient | undefined

/** the server's C-Chain client, on the RPC chainRpc picks; one per server, made on first use */
function cChain(): PublicClient {
  client ??= createPublicClient({
    chain: avalanche,
    transport: http(chainRpc(43114) ?? undefined, { timeout: 8_000, retryCount: 1 }),
  })
  return client
}

/** the position's committed capital and outstanding principal, as the line reads them now */
export function readCreditPosition(facility: LineFacility): Promise<CreditPosition> {
  return readThrough(CacheKeys.line(facility.slug, 'position'), async () => {
    const { positionId } = facility.line
    const data = encodeFunctionData({ abi: LINE_ABI, functionName: 'getCreditPosition', args: [BigInt(positionId)] })
    const { data: credit } = await cChain().call({ to: getAddress(facility.pool.address), data })
    if (!credit || size(credit) !== CREDIT_BYTES) {
      throw new Error(`${facility.slug}: getCreditPosition(${positionId}) did not answer the ${CREDIT_BYTES}-byte Credit struct`)
    }
    // words 0 and 1 only: the later words hold interest and the position's terms, and are never decoded
    return { deposit: hexToBigInt(slice(credit, 0, 32)), principal: hexToBigInt(slice(credit, 32, 64)) }
  })
}
