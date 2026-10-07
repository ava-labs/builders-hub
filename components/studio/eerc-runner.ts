'use client';

import { createPublicClient, getAddress, http, type Hex, type PublicClient } from 'viem';
import { chainFor, type ChainInfo, type ConsoleSigner } from '@/lib/console-wallets/signer';
import { runEERC, type EERCRequest, type EERCStage } from '@/lib/eerc/client';

/** What a manual step carries when the browser can run it; see `browser` on the server's manual action. */
export interface BrowserStep {
  action: string;
  chainId: number;
  inputs: Record<string, unknown>;
}

export interface BrowserStepResult {
  txHash?: Hex;
  outputs?: Record<string, string>;
}

export const BROWSER_STEP_LABEL: Record<string, string> = {
  'eerc.register': 'Deriving your eERC key and proving the registration in this browser…',
  'eerc.private-mint': 'Generating the mint proof in this browser…',
  'eerc.deposit': 'Encrypting the deposit amount in this browser…',
  'eerc.transfer': 'Generating the transfer proof in this browser…',
  'eerc.withdraw': 'Generating the withdrawal proof in this browser…',
  'eerc.decrypt-balance': 'Decrypting your encrypted balance in this browser…',
};

export const STAGE_LABEL: Record<EERCStage, string> = {
  signature: 'Signing once to unlock your private key…',
  proof: 'Generating the zero-knowledge proof in this browser…',
  transaction: 'Sending the transaction…',
  confirming: 'Waiting for the transaction to confirm…',
};

const text = (value: unknown) => (value === undefined || value === null ? undefined : String(value));

/** The step as a request to the shared eERC client. */
function requestFor(step: BrowserStep): EERCRequest | null {
  const i = step.inputs;
  const token = text(i.encryptedERC);
  switch (step.action) {
    case 'eerc.register':
      return { op: 'register', registrar: text(i.registrar) };
    case 'eerc.private-mint':
      return token ? { op: 'mint', token, to: text(i.recipient)!, amount: text(i.amount)! } : null;
    case 'eerc.deposit':
      return token ? { op: 'deposit', token, erc20: text(i.token)!, amount: text(i.amount)! } : null;
    case 'eerc.transfer':
      return token ? { op: 'transfer', token, to: text(i.to)!, amount: text(i.amount)!, erc20: text(i.token) } : null;
    case 'eerc.withdraw':
      return token ? { op: 'withdraw', token, amount: text(i.amount)!, erc20: text(i.token) } : null;
    case 'eerc.decrypt-balance':
      return token ? { op: 'balance', token, erc20: text(i.token) } : null;
  }
  return null;
}

/**
 * Whether this signer can run the step itself. Registering or reading a
 * balance is for one account, and only that account's wallet can derive its
 * key, so another account's registration stays a manual step.
 */
export function canRunInBrowser(step: BrowserStep, signer: ConsoleSigner): boolean {
  if (!requestFor(step)) return false;
  if (step.action === 'eerc.register' || step.action === 'eerc.decrypt-balance') {
    const account = step.inputs.account;
    return typeof account === 'string' && getAddress(account) === getAddress(signer.address);
  }
  return true;
}

/** Runs an eERC step with Studio's signer; keys and proofs never leave the browser, and the server checks the chain. */
export async function runBrowserStep(
  step: BrowserStep,
  signer: ConsoleSigner,
  info: ChainInfo | undefined,
  onStage?: (stage: EERCStage) => void,
): Promise<BrowserStepResult> {
  const request = requestFor(step);
  if (!request) throw new Error(`Studio can't run ${step.action} in the browser`);
  const chain = chainFor(step.chainId, info);
  const client = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) }) as PublicClient;
  const result = await runEERC(request, {
    client,
    chainId: step.chainId,
    onStage,
    signer: {
      address: signer.address,
      signMessage: (message) => signer.signMessage(message),
      send: (tx) => signer.send(step.chainId, info, { to: tx.to, data: tx.data, value: '0' }),
    },
  });
  if (step.action === 'eerc.decrypt-balance') return { outputs: { balance: result.cents ?? '0' } };
  return { txHash: result.txHash };
}
