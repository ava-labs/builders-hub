import { secp256k1, utils } from '@avalabs/avalanchejs'
import { sha256 } from '@noble/hashes/sha256'
import { ripemd160 } from '@noble/hashes/ripemd160'
import { bytesToHex } from '@noble/hashes/utils'
import type { AddressInfo, GenesisAllocation } from './types'
import { lookupGenesis } from './genesis-index'

const MAINNET_HRP = 'avax'

export function stripChainPrefix(address: string): string {
  return address.replace(/^(X-|P-|C-)/, '')
}

export function isAvaxBech32(address: string): boolean {
  const stripped = stripChainPrefix(address)
  return stripped.startsWith(MAINNET_HRP + '1') || stripped.startsWith('fuji1')
}

export function isEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address)
}

export function detectChainFromPrefix(address: string): 'X' | 'P' | 'C' | null {
  if (address.startsWith('X-')) return 'X'
  if (address.startsWith('P-')) return 'P'
  if (address.startsWith('C-')) return 'C'
  return null
}

export function bech32Decode(address: string): Uint8Array {
  const stripped = stripChainPrefix(address)
  return utils.bech32ToBytes(stripped)
}

export function bech32Encode(addressBytes: Uint8Array, hrp?: string): string {
  return utils.formatBech32(hrp ?? MAINNET_HRP, addressBytes)
}

export function pubkeyToAvaxAddress(compressedPubkey: Uint8Array): string {
  const addressBytes = secp256k1.publicKeyBytesToAddress(compressedPubkey)
  return utils.formatBech32(MAINNET_HRP, addressBytes)
}

export function pubkeyToEthAddress(compressedPubkey: Uint8Array): string {
  const addrBytes = secp256k1.publicKeyToEthAddress(compressedPubkey)
  return `0x${bytesToHex(addrBytes)}`
}

export function addressBytesToHex(addressBytes: Uint8Array): string {
  return `0x${bytesToHex(addressBytes)}`
}

export function ripemd160Sha256(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data))
}

export function normalizeAddress(address: string): AddressInfo {
  const raw = address.trim()

  if (isEthAddress(raw)) {
    return {
      raw,
      xChain: '', // Cannot derive bech32 from 0x without pubkey
      pChain: '',
      cChain: raw.toLowerCase(),
    }
  }

  const stripped = stripChainPrefix(raw)

  if (isAvaxBech32(stripped)) {
    const addressBytes = bech32Decode(stripped)
    const bech32Addr = bech32Encode(addressBytes)

    return {
      raw,
      xChain: `X-${bech32Addr}`,
      pChain: `P-${bech32Addr}`,
      cChain: undefined,
    }
  }

  return {
    raw,
    xChain: raw,
    pChain: raw,
    cChain: undefined,
  }
}

export function deriveAllAddressesFromPubkey(
  compressedPubkey: Uint8Array
): AddressInfo {
  const avaxAddr = pubkeyToAvaxAddress(compressedPubkey)
  const ethAddr = pubkeyToEthAddress(compressedPubkey)

  return {
    raw: avaxAddr,
    xChain: `X-${avaxAddr}`,
    pChain: `P-${avaxAddr}`,
    cChain: ethAddr,
  }
}

export async function resolveWithGenesis(
  address: string
): Promise<{ addressInfo: AddressInfo; genesisAllocation?: GenesisAllocation }> {
  const addressInfo = normalizeAddress(address)

  const lookupAddr = addressInfo.cChain ?? stripChainPrefix(addressInfo.xChain)
  const genesisAllocation = await lookupGenesis(lookupAddr)

  return { addressInfo, genesisAllocation }
}

export function extractPubkeysFromCredentials(
  credentials: Array<{ signatures: string[] }>
): Uint8Array[] {
  // Credentials in P-Chain/X-Chain txs contain signatures
  // We cannot directly extract pubkeys from signatures alone without
  // the original message. This function is a placeholder that would need
  // the tx bytes + signature recovery (ecrecover) to work fully.
  // For now, we return empty since the Glacier API sometimes provides
  // pubkeys directly in the transaction data.
  return []
}
