import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { avaxSerial, BigIntPr, Id, Int, OutputOwners, TransferOutput, utils, Utxo } from '@avalabs/avalanchejs'

import type { platformTools as PlatformTools } from '@/lib/mcp/tools/platform'
import type { dataTools as DataTools } from '@/lib/mcp/tools/data'
import { UTXO_PAGE_SIZE } from '@/components/toolbox/utils/sharedMemoryImport'

// Two stakeable-locked UTXOs (33,000 AVAX each) from api.avax.network for
// P-avax144wptphlhsdy8yu423acq6m29mvfgnz4het0u4 (2026-10-26). platform.getBalance gave
// lockedStakeable 66000000000000 for that address on the same day.
const MAINNET_STAKEABLE = [
  '0x0000e825c18e7e444ad010ae742eb29c09f1a68bb7b4daad1884835dd411251204d30000002921e67317cbc4be2aeb00677ad6462778a8f52274b9d605df2591b23027a87dff000000160000000071e384800000000700001e036947100000000000000000000000000100000001ad5c1586ffbc1a439395547b806b6a2ed8944c55b96027e4',
  '0x00005f7c074ffe4fb9d19fe155300e6f89d9673dfb656f071542df35e90e8928b9d20000000f21e67317cbc4be2aeb00677ad6462778a8f52274b9d605df2591b23027a87dff00000016000000006ea4f3800000000700001e036947100000000000000000000000000100000001ad5c1586ffbc1a439395547b806b6a2ed8944c55bf9eb9c6',
]
const AVAX = 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z'
const OTHER_ASSET = Id.fromHex(`0x${'22'.repeat(32)}`).toString()
const ADDRESS = 'P-avax144wptphlhsdy8yu423acq6m29mvfgnz4het0u4'

let nextTx = 1

/** An unlocked TransferOutput UTXO, encoded as platform.getUTXOs returns it with encoding 'hex'. */
function plainHex(amount: bigint, asset = AVAX): string {
  const txId = Id.fromHex(`0x${(nextTx++).toString(16).padStart(64, '0')}`)
  const utxo = new Utxo(
    new avaxSerial.UTXOID(txId, new Int(0)),
    Id.fromString(asset),
    new TransferOutput(new BigIntPr(amount), OutputOwners.fromNative([new Uint8Array(20).fill(7)], 0n, 1)),
  )
  const manager = utils.getManagerForVM('PVM')
  const bytes = utils.concatBytes(manager.getDefaultCodecId().toBytes(), utxo.toBytes(manager.getDefaultCodec()))
  return utils.bufferToHex(utils.addChecksum(bytes))
}

let platformTools: typeof PlatformTools
let dataTools: typeof DataTools

beforeEach(async () => {
  // A new module graph per test, so the MCP cache does not answer from an earlier test.
  vi.resetModules()
  ;({ platformTools } = await import('@/lib/mcp/tools/platform'))
  ;({ dataTools } = await import('@/lib/mcp/tools/data'))
})

afterEach(() => vi.restoreAllMocks())

/** Answers every platform.getUTXOs call with `page`, and records the methods. */
function mockNode(page: () => string[]) {
  const methods: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    methods.push(body.method)
    const utxos = page()
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: 1, result: { utxos, endIndex: { address: ADDRESS, utxo: 'x' }, encoding: 'hex' } }),
      { headers: { 'content-type': 'application/json' } },
    )
  })
  return methods
}

describe('platform_get_balance', () => {
  it('answers with the fields and per-asset maps of platform.getBalance, from platform.getUTXOs', async () => {
    const other = plainHex(7n, OTHER_ASSET)
    const methods = mockNode(() => [...MAINNET_STAKEABLE, other])
    const result = await platformTools.handlers.platform_get_balance({ addresses: [ADDRESS], network: 'mainnet' })
    expect(result.isError).toBeFalsy()
    const json = JSON.parse(result.content[0]!.text)
    expect(methods).toEqual(['platform.getUTXOs'])
    expect(json).toMatchObject({
      balance: '66000000000000',
      unlocked: '0',
      lockedStakeable: '66000000000000',
      lockedNotStakeable: '0',
      balances: { [AVAX]: '66000000000000', [OTHER_ASSET]: '7' },
      unlockeds: { [OTHER_ASSET]: '7' },
      lockedStakeables: { [AVAX]: '66000000000000' },
      lockedNotStakeables: {},
      complete: true,
      balance_avax: '66000',
      unlocked_avax: '0',
    })
    expect(json.utxoIDs).toHaveLength(3)
  })
})

describe('onchain_lookup on a P-Chain address', () => {
  it('says at the top level when the read stopped before the last page', async () => {
    mockNode(() => Array.from({ length: UTXO_PAGE_SIZE }, () => plainHex(1n)))
    const result = await dataTools.handlers.onchain_lookup({ value: ADDRESS })
    const json = JSON.parse(result.content[0]!.text)
    expect(json.kind).toBe('pchain-address')
    expect(json.incomplete).toMatch(/lower bound/)
    expect(json.raw.complete).toBe(false)
  })

  it('has no incomplete line for a full read', async () => {
    mockNode(() => MAINNET_STAKEABLE)
    const json = JSON.parse((await dataTools.handlers.onchain_lookup({ value: ADDRESS })).content[0]!.text)
    expect(json).toMatchObject({ kind: 'pchain-address', balanceAvax: '66000', lockedStakeableAvax: '66000', utxoCount: 2 })
    expect(json.incomplete).toBeUndefined()
  })
})
