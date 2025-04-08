import { secp256k1, UnsignedTx, utils, pvm, Utxo, Context, evm } from '@avalabs/avalanchejs';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { Address } from 'micro-eth-signer';
import { keccak256, toRlp, toBytes, createPublicClient, http, parseEther } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { deduplicateEthRequestAccounts } from '@/components/tools/common/ui/deduplicateEthRequestAccounts';
// Type definitions
declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: any[] }) => Promise<any>;
            on: (event: string, callback: (...args: any[]) => void) => void;
            removeListener: (event: string, callback: (...args: any[]) => void) => void;
        };
    }
}

export const RPC_ENDPOINT = "https://api.avax-test.network";

// Wallet Functions
export async function getWalletAddress() {
    if (!window.avalanche) {
        throw new Error('No wallet detected');
    }
    const accounts = await deduplicateEthRequestAccounts()
    if (!accounts || accounts.length === 0) {
        throw new Error('No account found');
    }
    return accounts[0];
}

export function newPrivateKey(): string {
    return bytesToHex(secp256k1.randomPrivateKey());
}

export function getAddresses(privateKeyHex: string): { C: `0x${string}`, P: string } {
    const publicKey = secp256k1.getPublicKey(hexToBytes(privateKeyHex));
    const pChainAddress = `P-${utils.formatBech32(
        "fuji",
        secp256k1.publicKeyBytesToAddress(publicKey)
    )}`;
    const cChainAddress = Address.fromPublicKey(publicKey) as `0x${string}`;
    return {
        C: cChainAddress,
        P: pChainAddress
    };
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

export function calculateContractAddress(deployerPrivateKey: string, nonce: number): `0x${string}` {
    const { C: deployerAddress } = getAddresses(deployerPrivateKey);
    const addressBytes = toBytes(deployerAddress);
    const nonceBytes = nonce === 0 ? new Uint8Array() : toBytes(nonce);
    const encodedData = toRlp([addressBytes, nonceBytes]);
    const hash = keccak256(encodedData);
    const contractAddress = `0x${hash.slice(-40)}` as `0x${string}`;
    return contractAddress;
}

// UTXO Transfer Functions
export async function transferCToP(amount: string, privateKeyHex: string, setNewPChainBalance: (balance: string) => void) {
    const publicClient = createPublicClient({
        chain: avalancheFuji,
        transport: http(RPC_ENDPOINT + '/ext/bc/C/rpc')
    });
    const address = await getAddresses(privateKeyHex);

    const balance = await publicClient.getBalance({ address: address.C });
    const amountToTransfer = parseEther(amount);

    if (balance < amountToTransfer) {
        throw new Error('Insufficient C-chain balance');
    }

    const avaxAmount = Number(amountToTransfer) / 1e18;
    await exportUTXO(privateKeyHex, avaxAmount);

    let imported = false;
    for (let i = 0; i < 3; i++) {
        if (i !== 0) await new Promise(resolve => setTimeout(resolve, 2000));
        imported = await importExistingUTXOs(privateKeyHex);
        if (imported) break;
    }

    if (!imported) {
        throw new Error('Export transaction may still be processing - no UTXOs found to import after 3 attempts');
    }

    const newBalance = await getPChainBalance(address.P);
    setNewPChainBalance(newBalance);
}

async function exportUTXO(privateKeyHex: string, amount: number) {
    const publicClient = createPublicClient({
        chain: avalancheFuji,
        transport: http(RPC_ENDPOINT + '/ext/bc/C/rpc')
    });
    const evmapi = new evm.EVMApi(RPC_ENDPOINT);

    const context = await Context.getContextFromURI(RPC_ENDPOINT);
    const address = await getAddresses(privateKeyHex);
    const txCount = await publicClient.getTransactionCount({ address: address.C });
    const baseFee = await evmapi.getBaseFee();
    const addressBytes = utils.bech32ToBytes(address.P);

    const tx = evm.newExportTxFromBaseFee(
        context,
        baseFee / BigInt(1e9),
        BigInt(amount * 1e9),
        context.pBlockchainID,
        utils.hexToBuffer(address.C),
        [addressBytes],
        BigInt(txCount),
    );

    await addSignature(tx, privateKeyHex);
    await evmapi.issueSignedTx(tx.getSignedTx());
}

async function getUTXOS(privateKeyHex: string) {
    const myAddress = await getAddresses(privateKeyHex);
    const pvmApi = new pvm.PVMApi(RPC_ENDPOINT);
    const { utxos } = await pvmApi.getUTXOs({
        sourceChain: 'C',
        addresses: [myAddress.P],
    });
    return utxos;
}

async function importUTXOs(privateKeyHex: string, utxos: Utxo[]) {
    const myAddress = await getAddresses(privateKeyHex);
    const pvmApi = new pvm.PVMApi(RPC_ENDPOINT);
    const feeState = await pvmApi.getFeeState();
    const context = await Context.getContextFromURI(RPC_ENDPOINT);

    const importTx = pvm.e.newImportTx(
        {
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(myAddress.P)],
            sourceChainId: context.cBlockchainID,
            toAddressesBytes: [utils.bech32ToBytes(myAddress.P)],
            utxos,
        },
        context,
    );

    await addSignature(importTx, privateKeyHex);
    return await pvmApi.issueSignedTx(importTx.getSignedTx());
}

async function importExistingUTXOs(privateKeyHex: string): Promise<boolean> {
    const utxos = await getUTXOS(privateKeyHex);
    if (utxos.length === 0) {
        return false;
    }
    await importUTXOs(privateKeyHex, utxos);
    return true;
}

async function getPChainBalance(address: string): Promise<string> {
    const response = await fetch('https://api.avax-test.network/ext/bc/P', {
        method: 'POST',
        headers: {
            'content-type': 'application/json;'
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "platform.getBalance",
            params: {
                addresses: [address]
            }
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || 'Failed to fetch P-chain balance');
    }

    return data.result.balance;
}
