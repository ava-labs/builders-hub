// One entry point for every Encrypted ERC operation a Studio-built app or the
// Studio runner performs: status, register, balance, deposit, transfer,
// withdraw and mint. The caller supplies a public client and a signer
// (address + signMessage + send); keys are derived and proofs generated here,
// in the browser, and only transaction hashes and plaintext numbers come out.

import { encodeFunctionData, getAddress, type Abi, type PublicClient } from 'viem';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import RegistrarArtifact from '@/contracts/encrypted-erc/compiled/Registrar.json';
import { validateEERCBalance, type EERCPCT, type RawEERCAmountPCT } from './balanceValidation';
import type { BJPoint } from './crypto/babyjub';
import { Scalar } from './crypto/scalar';
import { deriveIdentity, loadIdentity, saveIdentity, type EERCIdentitySecret } from './identity';
import { assertEERCIdentityMatchesOnChain, isZeroEERCPublicKey } from './identityValidation';
import { computeDepositCents, depositToEERC, ERC20_MINIMAL_ABI } from './operations/deposit';
import { privateMint } from './operations/mint';
import { transferPrivate } from './operations/transfer';
import { withdrawFromEERC } from './operations/withdraw';
import { registerOnChain } from './register';
import type { EERCDeployment, Hex } from './types';

export interface EERCSigner {
  address: Hex;
  /** EIP-191 personal_sign, used once to derive the BabyJubJub key. */
  signMessage(message: string): Promise<Hex>;
  /** Sends a prepared call on `chainId` and returns its hash. */
  send(tx: { to: Hex; data: Hex }): Promise<Hex>;
}

/** Amounts are strings so requests survive postMessage and JSON. eERC amounts are in cents (2 decimals). */
export type EERCRequest =
  | { op: 'status'; token: string; erc20?: string }
  | { op: 'register'; token?: string; registrar?: string }
  | { op: 'isRegistered'; token: string; account: string }
  | { op: 'balance'; token: string; erc20?: string }
  | { op: 'deposit'; token: string; erc20: string; amount: string }
  | { op: 'transfer'; token: string; to: string; amount: string; erc20?: string }
  | { op: 'withdraw'; token: string; amount: string; erc20?: string }
  | { op: 'mint'; token: string; to: string; amount: string };

export const EERC_OPS = new Set<EERCRequest['op']>([
  'status',
  'register',
  'isRegistered',
  'balance',
  'deposit',
  'transfer',
  'withdraw',
  'mint',
]);

export type EERCStage = 'signature' | 'proof' | 'transaction' | 'confirming';

export interface EERCStatus {
  account: Hex;
  registered: boolean;
  /** The local key matches the Registrar, so the balance can be read without a signature. */
  unlocked: boolean;
  isConverter: boolean;
  decimals: number;
  owner: Hex;
  isOwner: boolean;
  auditorSet: boolean;
  /** Converter mode: the ERC-20s it holds. */
  tokens: Hex[];
}

export interface EERCResult {
  txHash?: Hex;
  /** Balance in cents, and as "12.34". */
  cents?: string;
  formatted?: string;
  /** Deposit: the part of the amount too small for 2 decimals, refunded by the contract. */
  dust?: string;
  registered?: boolean;
  status?: EERCStatus;
}

const EERC_ABI = EncryptedERCArtifact.abi as Abi;
const REGISTRAR_ABI = RegistrarArtifact.abi as Abi;
const DECIMALS_ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const satisfies Abi;

const address = (value: unknown, name: string): Hex => {
  if (typeof value !== 'string') throw new Error(`Missing ${name}`);
  return getAddress(value) as Hex;
};
const cents = (value: unknown, name = 'amount'): bigint => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error(`The ${name} must be a whole number of cents`);
  const n = BigInt(value);
  if (n <= 0n) throw new Error(`The ${name} must be above zero`);
  return n;
};

type Pt = { x: bigint; y: bigint } | readonly [bigint, bigint];
const point = (p: Pt): readonly [bigint, bigint] =>
  Array.isArray(p) ? [p[0], p[1]] : [(p as { x: bigint }).x, (p as { y: bigint }).y];

export async function runEERC(
  request: EERCRequest,
  {
    client,
    signer,
    chainId,
    onStage,
  }: {
    client: PublicClient;
    signer: EERCSigner;
    chainId: number;
    onStage?: (stage: EERCStage) => void;
  },
): Promise<EERCResult> {
  const me = getAddress(signer.address) as Hex;
  // A registration can name the Registrar directly (Studio's runner does, before any token exists).
  const directRegistrar =
    request.op === 'register' && request.registrar ? address(request.registrar, 'registrar') : null;
  const token = directRegistrar ? (null as unknown as Hex) : address(request.token, 'token');
  const read = <T>(target: Hex, abi: Abi, functionName: string, args: unknown[] = []) =>
    client.readContract({ address: target, abi, functionName, args }) as Promise<T>;

  const write = async (args: { address: Hex; abi: unknown[]; functionName: string; args: unknown[] }) => {
    onStage?.('transaction');
    const data = encodeFunctionData({ abi: args.abi as Abi, functionName: args.functionName, args: args.args });
    const hash = await signer.send({ to: args.address, data });
    onStage?.('confirming');
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    if (receipt.status !== 'success') throw new Error(`The ${args.functionName} transaction reverted`);
    return hash;
  };

  const registrar = directRegistrar ?? (await read<Hex>(token, EERC_ABI, 'registrar'));
  const publicKeyOf = (account: Hex) =>
    read<readonly [bigint, bigint]>(registrar, REGISTRAR_ABI, 'getUserPublicKey', [account]);
  const sign = (message: string) => {
    onStage?.('signature');
    return signer.signMessage(message);
  };

  /** The caller's key: the cached one if it matches the Registrar, else re-derived from one signature. */
  const identity = async (): Promise<EERCIdentitySecret> => {
    const onChain = await publicKeyOf(me);
    if (isZeroEERCPublicKey(onChain))
      throw new Error('Create your private account first: this wallet is not registered yet.');
    let id = loadIdentity(me, registrar);
    if (!id || id.publicKey[0] !== onChain[0] || id.publicKey[1] !== onChain[1]) id = await deriveIdentity(me, sign);
    assertEERCIdentityMatchesOnChain(id, onChain);
    saveIdentity(me, registrar, id);
    return id;
  };

  const tokenIdOf = async (erc20: string | undefined) => {
    if (!erc20) return 0n;
    const id = await read<bigint>(token, EERC_ABI, 'tokenIds', [address(erc20, 'ERC-20')]);
    if (id === 0n) throw new Error('This token has not been deposited into the converter yet');
    return id;
  };

  /** The encrypted balance, flattened, and decrypted with the caller's key. */
  const balanceOf = async (id: EERCIdentitySecret, erc20: string | undefined) => {
    const raw = await read<readonly [{ c1: Pt; c2: Pt }, bigint, readonly RawEERCAmountPCT[], EERCPCT, bigint]>(
      token,
      EERC_ABI,
      erc20 ? 'getBalanceFromTokenAddress' : 'balanceOfStandalone',
      erc20 ? [me, address(erc20, 'ERC-20')] : [me],
    );
    const c1 = point(raw[0].c1);
    const c2 = point(raw[0].c2);
    const result = validateEERCBalance({ eGCT: { c1, c2 }, amountPCTs: raw[2], balancePCT: raw[3] }, id);
    if (!result.ok) throw new Error(result.message);
    return { flat: [c1[0], c1[1], c2[0], c2[1]] as const, cents: result.decryptedCents };
  };

  const auditorKey = async (): Promise<BJPoint> => {
    const key = await read<readonly [bigint, bigint]>(token, EERC_ABI, 'auditorPublicKey');
    if (key[0] === 0n && key[1] === 0n) throw new Error('This token has no auditor key yet, so it cannot move funds');
    return [key[0], key[1]] as BJPoint;
  };

  const deployment = (decimals: number) => ({ encryptedERC: token, registrar, decimals }) as unknown as EERCDeployment;

  switch (request.op) {
    case 'status': {
      const [registered, isConverter, decimals, owner, auditorSet, tokens] = await Promise.all([
        read<boolean>(registrar, REGISTRAR_ABI, 'isUserRegistered', [me]),
        read<boolean>(token, EERC_ABI, 'isConverter'),
        read<number>(token, EERC_ABI, 'decimals'),
        read<Hex>(token, EERC_ABI, 'owner'),
        read<boolean>(token, EERC_ABI, 'isAuditorKeySet'),
        read<Hex[]>(token, EERC_ABI, 'getTokens').catch(() => [] as Hex[]),
      ]);
      const local = loadIdentity(me, registrar);
      const onChain = registered ? await publicKeyOf(me) : null;
      const unlocked = !!local && !!onChain && local.publicKey[0] === onChain[0] && local.publicKey[1] === onChain[1];
      return {
        status: {
          account: me,
          registered,
          unlocked,
          isConverter,
          decimals: Number(decimals),
          owner,
          isOwner: getAddress(owner) === me,
          auditorSet,
          tokens,
        },
      };
    }

    case 'isRegistered':
      return {
        registered: await read<boolean>(registrar, REGISTRAR_ABI, 'isUserRegistered', [
          address(request.account, 'account'),
        ]),
      };

    case 'register': {
      if (await read<boolean>(registrar, REGISTRAR_ABI, 'isUserRegistered', [me])) {
        await identity();
        return { registered: true };
      }
      onStage?.('signature');
      const id = await deriveIdentity(me, sign);
      onStage?.('proof');
      const { txHash } = await registerOnChain({
        address: me,
        chainId,
        registrarAddress: registrar,
        signMessage: sign,
        writeContract: (args) => write(args),
        cachedIdentity: id,
      });
      saveIdentity(me, registrar, id);
      return { txHash, registered: true };
    }

    case 'balance': {
      const id = await identity();
      const { cents: value } = await balanceOf(id, request.erc20);
      return { cents: value.toString(), formatted: Scalar.parseEERCBalance(value) };
    }

    case 'deposit': {
      const erc20 = address(request.erc20, 'ERC-20');
      if (!/^\d+$/.test(request.amount)) throw new Error("The deposit is in the token's base units, as a whole number");
      const amountWei = BigInt(request.amount);
      if (amountWei <= 0n) throw new Error('The deposit must be above zero');
      const id = await identity();
      const [eercDecimals, tokenDecimals, allowance] = await Promise.all([
        read<number>(token, EERC_ABI, 'decimals'),
        read<number>(erc20, DECIMALS_ABI as unknown as Abi, 'decimals'),
        read<bigint>(erc20, ERC20_MINIMAL_ABI as unknown as Abi, 'allowance', [me, token]),
      ]);
      // Approve first when the allowance is short, so a deposit is one action for the user.
      if (allowance < amountWei) {
        await write({
          address: erc20,
          abi: ERC20_MINIMAL_ABI as unknown as unknown[],
          functionName: 'approve',
          args: [token, amountWei],
        });
      }
      const { dustWei } = computeDepositCents(amountWei, Number(tokenDecimals), Number(eercDecimals));
      const { txHash } = await depositToEERC({
        deployment: deployment(Number(eercDecimals)),
        token: { address: erc20, decimals: Number(tokenDecimals), symbol: '', name: '' },
        amountWei,
        userPublicKey: id.publicKey,
        writeContract: (args) => write(args),
      });
      return { txHash, dust: dustWei.toString() };
    }

    case 'transfer': {
      const to = address(request.to, 'recipient');
      const amount = cents(request.amount);
      const id = await identity();
      const [recipientKey, auditor, tokenId, decimals] = await Promise.all([
        publicKeyOf(to),
        auditorKey(),
        tokenIdOf(request.erc20),
        read<number>(token, EERC_ABI, 'decimals'),
      ]);
      if (isZeroEERCPublicKey(recipientKey)) throw new Error("The recipient hasn't created a private account yet");
      const balance = await balanceOf(id, request.erc20);
      onStage?.('proof');
      const { txHash } = await transferPrivate({
        deployment: deployment(Number(decimals)),
        senderAddress: me,
        senderPrivateKey: id.formattedKey,
        senderPublicKey: id.publicKey,
        recipientAddress: to,
        recipientPublicKey: [recipientKey[0], recipientKey[1]] as BJPoint,
        auditorPublicKey: auditor,
        encryptedBalance: balance.flat,
        decryptedBalance: balance.cents,
        amount,
        tokenId,
        writeContract: (args) => write(args),
      });
      return { txHash };
    }

    case 'withdraw': {
      const amount = cents(request.amount);
      const id = await identity();
      const [auditor, tokenId, decimals] = await Promise.all([
        auditorKey(),
        tokenIdOf(request.erc20),
        read<number>(token, EERC_ABI, 'decimals'),
      ]);
      const balance = await balanceOf(id, request.erc20);
      onStage?.('proof');
      const { txHash } = await withdrawFromEERC({
        deployment: deployment(Number(decimals)),
        senderAddress: me,
        senderPrivateKey: id.formattedKey,
        senderPublicKey: id.publicKey,
        auditorPublicKey: auditor,
        encryptedBalance: balance.flat,
        decryptedBalance: balance.cents,
        amount,
        tokenId,
        writeContract: (args) => write(args),
      });
      return { txHash };
    }

    case 'mint': {
      const to = address(request.to, 'recipient');
      const amount = cents(request.amount);
      const owner = await read<Hex>(token, EERC_ABI, 'owner');
      if (getAddress(owner) !== me) throw new Error('Only the token owner can mint');
      const [recipientKey, auditor] = await Promise.all([publicKeyOf(to), auditorKey()]);
      onStage?.('proof');
      const { txHash } = await privateMint({
        encryptedERC: token,
        chainId,
        recipientAddress: to,
        recipientPublicKey: [recipientKey[0], recipientKey[1]] as BJPoint,
        auditorPublicKey: auditor,
        amount,
        writeContract: (args) => write(args),
      });
      return { txHash };
    }
  }
}

/** Checks a request's shape before it reaches runEERC; requests from an app's frame are untrusted. */
export function parseEERCRequest(value: unknown): EERCRequest {
  const r = value as Record<string, unknown> | null;
  if (!r || typeof r.op !== 'string' || !EERC_OPS.has(r.op as EERCRequest['op']))
    throw new Error('Unsupported eERC request');
  const str = (k: string, optional = false) => {
    const v = r[k];
    if (v === undefined && optional) return undefined;
    if (typeof v !== 'string' || v.length > 100) throw new Error(`Bad eERC request: ${k}`);
    return v;
  };
  if (r.op === 'register') return { op: 'register', token: str('token')! };
  const token = str('token')!;
  switch (r.op) {
    case 'status':
    case 'balance':
      return { op: r.op, token, erc20: str('erc20', true) };
    case 'isRegistered':
      return { op: 'isRegistered', token, account: str('account')! };
    case 'deposit':
      return { op: 'deposit', token, erc20: str('erc20')!, amount: str('amount')! };
    case 'transfer':
      return { op: 'transfer', token, to: str('to')!, amount: str('amount')!, erc20: str('erc20', true) };
    case 'withdraw':
      return { op: 'withdraw', token, amount: str('amount')!, erc20: str('erc20', true) };
    case 'mint':
      return { op: 'mint', token, to: str('to')!, amount: str('amount')! };
  }
  throw new Error('Unsupported eERC request');
}
