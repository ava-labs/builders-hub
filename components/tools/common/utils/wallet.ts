import { deduplicateEthRequestAccounts } from '../ui/deduplicateEthRequestAccounts';

declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: any[] }) => Promise<any>;
            on: (event: string, callback: (...args: any[]) => void) => void;
            removeListener: (event: string, callback: (...args: any[]) => void) => void;
        };
    }
}

export async function getWalletAddress() {
    if (!window.avalanche) {
        throw new Error('No wallet detected');
    }

    const accounts = await deduplicateEthRequestAccounts()
    if (!accounts || accounts.length === 0) {
        throw new Error('No account found');
    }

    return accounts[0]; // Return the first account
}


import { secp256k1, UnsignedTx } from '@avalabs/avalanchejs';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';


export function newPrivateKey(): string {
    return bytesToHex(secp256k1.randomPrivateKey());
}


export async function addSignature(tx: UnsignedTx, privateKeyHex: string) {
    const privateKey = hexToBytes(privateKeyHex);
    const unsignedBytes = tx.toBytes();
    const publicKey = secp256k1.getPublicKey(privateKey);

    if (tx.hasPubkey(publicKey)) {
        const signature = await secp256k1.sign(unsignedBytes, privateKey);
        tx.addSignature(signature);
    } else {
        throw new Error("Public key not found in transaction");
    }
}
