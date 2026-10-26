import { BigIntPr, Id, OutputOwners, TransferOutput, Utxo, avaxSerial, pvmSerial, utils } from '@avalabs/avalanchejs';

/* P-Chain UTXOs as platform.getUTXOs returns them (hex), for the tests of lib/pchain-balance.ts and its callers. */

const pvmManager = utils.getManagerForVM('PVM');

/** A Fuji P-Chain address: twenty 0x01 bytes. */
export const TEST_ADDRESS = utils.format('P', 'fuji', new Uint8Array(20).fill(1));

/** A distinct CB58 tx ID for each n. */
export function txId(n: number): string {
  return Id.fromHex('0x' + n.toString(16).padStart(64, '0')).toString();
}

/** One platform.getUTXOs hex entry: codec version 0x0000, the UTXO, the 4-byte checksum. */
export function utxoHex(o: {
  txID: string;
  index: number;
  assetId: string;
  amount: bigint;
  address: string;
  locktime?: bigint;
  stakeableLocktime?: bigint;
}): string {
  const transfer = new TransferOutput(
    new BigIntPr(o.amount),
    OutputOwners.fromNative([utils.bech32ToBytes(o.address)], o.locktime ?? 0n, 1),
  );
  const output =
    o.stakeableLocktime === undefined
      ? transfer
      : new pvmSerial.StakeableLockOut(new BigIntPr(o.stakeableLocktime), transfer);
  const utxo = new Utxo(avaxSerial.UTXOID.fromNative(o.txID, o.index), Id.fromString(o.assetId), output);
  return utils.bufferToHex(utils.addChecksum(new Uint8Array([0, 0, ...utxo.toBytes(pvmManager.getDefaultCodec())])));
}
