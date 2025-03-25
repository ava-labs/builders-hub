import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { base58 } from '@scure/base';

const CHECKSUM_LENGTH = 4;

function calculateChecksum(data: Uint8Array): Uint8Array {
    // In Avalanche, hashing.Checksum uses a single SHA256
    return sha256(data).slice(0, CHECKSUM_LENGTH);
}

export function cb58ToBytes(cb58: string): Uint8Array {
    const decodedBytes = base58.decode(cb58);
    if (decodedBytes.length < CHECKSUM_LENGTH) {
        throw new Error('Input string is smaller than the checksum size');
    }

    return decodedBytes.slice(0, -CHECKSUM_LENGTH);
}


export function cb58ToHex(cb58: string, include0x: boolean = true, checkSum: boolean = false): string {
    let rawBytes = cb58ToBytes(cb58);
    if (checkSum) {
        const checksum = calculateChecksum(rawBytes);
        const combined = new Uint8Array(rawBytes.length + CHECKSUM_LENGTH);
        combined.set(rawBytes);
        combined.set(checksum, rawBytes.length);
        rawBytes = combined;
    }
    return (include0x ? '0x' : '') + bytesToHex(rawBytes);
}

export function hexToCB58(hex: string): string {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

    const checksum = calculateChecksum(bytes);
    const combined = new Uint8Array(bytes.length + CHECKSUM_LENGTH);
    combined.set(bytes);
    combined.set(checksum, bytes.length);
    
    return base58.encode(combined);
}

