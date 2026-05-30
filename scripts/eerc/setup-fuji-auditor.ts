/**
 * One-time post-deploy finishing script for the canonical Fuji eERC.
 *
 * Does what `deploy-fuji.ts` should have done originally:
 *   1. Derives the deployer's BabyJubJub identity from an EIP-191 signature
 *      over the standard REGISTER message.
 *   2. Generates a Groth16 registration proof in Node via snarkjs, using the
 *      circuit artifacts we already ship from public/eerc/circuits.
 *   3. Submits Registrar.register(proof) so the deployer has a BJJ pubkey
 *      on-chain.
 *   4. Calls setAuditorPublicKey(deployer) on BOTH the standalone and
 *      converter EncryptedERC contracts.
 *
 * After this runs once, ANYONE on Fuji can deposit/transfer/withdraw against
 * the canonical deployment — the auditor invariant is satisfied forever.
 *
 * Run:
 *   C_CHAIN_PRIVATE_KEY=0x... npx tsx ./scripts/eerc/setup-fuji-auditor.ts
 *
 * The key is read from env only, never written to disk. It must belong to the
 * original deployer (the account that shows up as `owner()` on the EncryptedERC
 * contracts) — otherwise setAuditorPublicKey reverts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { poseidon3 } from 'poseidon-lite';
import * as snarkjs from 'snarkjs';

import { BabyJub, FF, SNARK_FIELD_SIZE, REGISTER_MESSAGE, formatKeyForCurve, getPrivateKeyFromSignature } from '../../lib/eerc/crypto';
import { formatProofForSolidity } from '../../lib/eerc/proof';
import EncryptedERCArtifact from '../../contracts/encrypted-erc/compiled/EncryptedERC.json';
import RegistrarArtifact from '../../contracts/encrypted-erc/compiled/Registrar.json';
import deployments from '../../constants/eerc-deployments.json';

type Hex = `0x${string}`;

async function main() {
  const pk = process.env.C_CHAIN_PRIVATE_KEY;
  if (!pk || !pk.startsWith('0x')) {
    console.error('Missing C_CHAIN_PRIVATE_KEY (must start with 0x). Never commit this key.');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as Hex);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() });
  const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http() });

  const fuji = deployments.deployments['43113'];
  const standalone = fuji.standalone!;
  const converter = fuji.converter!;
  const registrar = standalone.registrar as Hex;

  console.log(`Deployer: ${account.address}`);
  console.log(`Registrar: ${registrar}`);
  console.log(`Standalone: ${standalone.encryptedERC}`);
  console.log(`Converter:  ${converter.encryptedERC}\n`);

  // --- Sanity: this wallet must be the owner of BOTH eERC instances ---------
  for (const [label, addr] of [
    ['standalone', standalone.encryptedERC],
    ['converter', converter.encryptedERC],
  ] as const) {
    const owner = (await publicClient.readContract({
      address: addr as Hex,
      abi: EncryptedERCArtifact.abi,
      functionName: 'owner',
    })) as Hex;
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      console.error(`Wallet ${account.address} is not the ${label} owner (owner is ${owner}).`);
      process.exit(1);
    }
  }

  // --- 1. Derive deterministic BJJ identity from EIP-191 signature ----------
  console.log('[1/4] Deriving BabyJubJub identity from wallet signature...');
  const signature = await account.signMessage({ message: REGISTER_MESSAGE(account.address as Hex) });
  const decryptionKey = getPrivateKeyFromSignature(signature);
  const formattedKey = formatKeyForCurve(decryptionKey);
  const curve = new BabyJub(new FF(SNARK_FIELD_SIZE));
  const publicKey = curve.generatePublicKey(formattedKey);
  console.log(`  pubKey.x = ${publicKey[0]}`);
  console.log(`  pubKey.y = ${publicKey[1]}\n`);

  // --- 2. Check if already registered ---------------------------------------
  const existing = (await publicClient.readContract({
    address: registrar,
    abi: RegistrarArtifact.abi,
    functionName: 'getUserPublicKey',
    args: [account.address],
  })) as readonly [bigint, bigint];

  const alreadyRegistered = existing[0] !== 0n || existing[1] !== 0n;
  if (alreadyRegistered) {
    console.log('[2/4] Already registered on Registrar — skipping proof generation.\n');
  } else {
    console.log('[2/4] Generating Groth16 registration proof...');
    // Same public-signals layout as lib/eerc/register.ts, kept in sync here.
    const chainIdBig = 43113n;
    const fullAddress = BigInt(account.address);
    const registrationHash = poseidon3([chainIdBig, formattedKey, fullAddress]);

    const circuitInput = {
      SenderPrivateKey: formattedKey,
      SenderPublicKey: [publicKey[0], publicKey[1]],
      SenderAddress: fullAddress,
      ChainID: chainIdBig,
      RegistrationHash: registrationHash,
    };

    const wasmPath = join(process.cwd(), 'public/eerc/circuits/registration/registration.wasm');
    const zkeyPath = join(process.cwd(), 'public/eerc/circuits/registration/registration.zkey');
    // Node reads artifacts from disk rather than the /eerc/circuits URL.
    readFileSync(wasmPath); // fail early with a clear message if missing
    readFileSync(zkeyPath);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(circuitInput, wasmPath, zkeyPath);
    const points = formatProofForSolidity(proof);
    const signals = publicSignals.map((s: string) => BigInt(s));
    if (signals.length !== 5) throw new Error(`Expected 5 register signals, got ${signals.length}`);

    const registerProof = {
      proofPoints: points,
      publicSignals: [signals[0], signals[1], signals[2], signals[3], signals[4]],
    };

    console.log('[3/4] Submitting register() to Registrar...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regHash = await (walletClient as any).writeContract({
      address: registrar,
      abi: RegistrarArtifact.abi,
      functionName: 'register',
      args: [registerProof],
    });
    console.log(`  tx: ${regHash}`);
    await publicClient.waitForTransactionReceipt({ hash: regHash as Hex });
    console.log('  confirmed.\n');
  }

  // --- 3. Set auditor on both contracts -------------------------------------
  for (const [label, addr] of [
    ['standalone', standalone.encryptedERC],
    ['converter', converter.encryptedERC],
  ] as const) {
    const current = (await publicClient.readContract({
      address: addr as Hex,
      abi: EncryptedERCArtifact.abi,
      functionName: 'auditor',
    })) as Hex;
    if (current.toLowerCase() === account.address.toLowerCase()) {
      console.log(`[4/4 ${label}] Auditor already set to ${current} — skipping.`);
      continue;
    }
    console.log(`[4/4 ${label}] setAuditorPublicKey(${account.address})...`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (walletClient as any).writeContract({
      address: addr as Hex,
      abi: EncryptedERCArtifact.abi,
      functionName: 'setAuditorPublicKey',
      args: [account.address],
    });
    console.log(`  tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
    console.log('  confirmed.');
  }

  // --- 4. Seed constants/eerc-deployments.json with auditor addresses -------
  // (Caller patches the file by hand — the script refuses to mutate JSON
  // silently so it's clear in code review what changed.)
  console.log(`\nDone. Patch constants/eerc-deployments.json:`);
  console.log(`  standalone.auditorAddress = "${account.address.toLowerCase()}"`);
  console.log(`  converter.auditorAddress  = "${account.address.toLowerCase()}"`);
  console.log(`\nAfter the patch: any Fuji wallet can deposit / transfer / withdraw against`);
  console.log(`the canonical eERC. No further owner action required.`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  // Defensive: never leak the private key if something deep in viem throws with it.
  console.error(msg.replace(/0x[a-fA-F0-9]{64}/g, '0x<REDACTED>'));
  process.exit(1);
});
