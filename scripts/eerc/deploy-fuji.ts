/**
 * Deploy the canonical Encrypted ERC infrastructure to Avalanche Fuji (C-Chain).
 *
 * Deploys (in order):
 *   1. BabyJubJub library
 *   2. Five Groth16 verifiers (registration, mint, transfer, withdraw, burn)
 *   3. Registrar (takes registration verifier)
 *   4. EncryptedERC in standalone mode  (a fresh private-native token)
 *   5. EncryptedERC in converter mode   (wraps existing ERC20s — mUSDC, WAVAX on Fuji)
 *
 * Auditor setup is NOT performed here — it requires a ZK proof which we
 * generate from the Register tool in the console. After this script runs,
 * visit /console/encrypted-erc/register on Fuji to register, then
 * /console/encrypted-erc/deploy/auditor to promote yourself to auditor.
 *
 * Usage:
 *   C_CHAIN_PRIVATE_KEY=0x... pnpm eerc:deploy-fuji
 *
 * The private key is read from env only — never persisted. It must have
 * ~2 AVAX on Fuji for all eight deployment transactions. Output addresses
 * are written to constants/eerc-deployments.json.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, http, encodeDeployData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';

// tsx compiles this to CJS where `import.meta.dirname` is undefined, so we
// anchor off the invocation cwd — the script is always run from the repo root
// via `pnpm eerc:deploy-fuji` (or the equivalent tsx invocation).
const REPO = process.cwd();
const EERC_BUILD = '/tmp/eerc-build';
const ARTIFACTS = join(EERC_BUILD, 'artifacts', 'contracts');
const DEPLOYMENTS_PATH = join(REPO, 'constants', 'eerc-deployments.json');

// Canonical Fuji WAVAX. Users on C-Chain always have AVAX (from the faucet),
// can wrap it into WAVAX via the Deposit tool, then deposit into eERC —
// a single public token path avoids access-controlled mock-token friction.
const FUJI_WAVAX = '0xd00ae08403B9bbb9124bB305C09058E32C39A48c' as const;

// eERC decimals is fixed at 2 by the canonical protocol constants.
const EERC_DECIMALS = 2;

type Hex = `0x${string}`;
type Artifact = { abi: unknown[]; bytecode: Hex; linkReferences?: Record<string, Record<string, { start: number; length: number }[]>> };

async function loadArtifact(solPath: string, contractName: string): Promise<Artifact> {
  const path = join(ARTIFACTS, solPath, `${contractName}.json`);
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    abi: parsed.abi,
    bytecode: parsed.bytecode as Hex,
    linkReferences: parsed.linkReferences,
  };
}

/**
 * Solidity emits `__$<34-hex-hash>__` placeholders in bytecode where library
 * addresses must be substituted at deploy time. Hardhat artifacts include
 * `linkReferences` describing each placeholder's byte offset; we use that to
 * splice in the real address without risking a substring collision.
 */
function linkLibraries(bytecode: Hex, artifact: Artifact, libraries: Record<string, Hex>): Hex {
  if (!artifact.linkReferences) return bytecode;
  let linked = bytecode.slice(2); // strip 0x
  for (const [solFile, libs] of Object.entries(artifact.linkReferences)) {
    for (const [libName, refs] of Object.entries(libs)) {
      const key = `${solFile}:${libName}`;
      const addr = libraries[key] ?? libraries[libName];
      if (!addr) throw new Error(`No address provided for library ${key}`);
      const stripped = addr.toLowerCase().replace(/^0x/, '').padStart(40, '0');
      for (const ref of refs) {
        const charStart = ref.start * 2;
        const charEnd = charStart + ref.length * 2;
        linked = linked.slice(0, charStart) + stripped + linked.slice(charEnd);
      }
    }
  }
  return `0x${linked}`;
}

async function main() {
  const pk = process.env.C_CHAIN_PRIVATE_KEY;
  if (!pk || !pk.startsWith('0x')) {
    console.error('Missing C_CHAIN_PRIVATE_KEY (must start with 0x). Never commit this key.');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as Hex);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() });
  const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http() });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer: ${account.address}`);
  console.log(`Balance : ${Number(balance) / 1e18} AVAX`);
  if (balance < 2n * 10n ** 17n) {
    console.error('Balance below 0.2 AVAX — fund the account from https://faucet.avax.network/');
    process.exit(1);
  }

  // 1. Load all artifacts. We use the DEV verifiers (contracts/verifiers/)
  //    since those match the zkit-generated zkey files we'll serve for
  //    client-side proving. The prod verifiers at contracts/prod/ require
  //    the iden3 trusted-setup zkeys we'd separately have to host.
  console.log('\n[1/8] Loading compiled artifacts...');
  const babyJubJub = await loadArtifact('libraries/BabyJubJub.sol', 'BabyJubJub');
  const registrationV = await loadArtifact('verifiers/RegistrationCircuitGroth16Verifier.sol', 'RegistrationCircuitGroth16Verifier');
  const mintV = await loadArtifact('verifiers/MintCircuitGroth16Verifier.sol', 'MintCircuitGroth16Verifier');
  const transferV = await loadArtifact('verifiers/TransferCircuitGroth16Verifier.sol', 'TransferCircuitGroth16Verifier');
  const withdrawV = await loadArtifact('verifiers/WithdrawCircuitGroth16Verifier.sol', 'WithdrawCircuitGroth16Verifier');
  const burnV = await loadArtifact('verifiers/BurnCircuitGroth16Verifier.sol', 'BurnCircuitGroth16Verifier');
  const registrar = await loadArtifact('Registrar.sol', 'Registrar');
  const encryptedERC = await loadArtifact('EncryptedERC.sol', 'EncryptedERC');

  async function deploy(name: string, artifact: Artifact, args: unknown[] = [], libs: Record<string, Hex> = {}): Promise<Hex> {
    const bytecode = linkLibraries(artifact.bytecode, artifact, libs);
    // viem's `encodeDeployData` is generic over abi/args; cast through unknown
    // to bypass strict inference since Hardhat JSON `abi` is typed as unknown[].
    const data = encodeDeployData({
      abi: artifact.abi as never,
      bytecode,
      args: args as never,
    } as unknown as Parameters<typeof encodeDeployData>[0]);
    const hash = await walletClient.sendTransaction({ data });
    process.stdout.write(`  ${name.padEnd(30)} → ${hash}`);
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    const addr = rcpt.contractAddress;
    if (!addr) throw new Error(`Deploy of ${name} returned no contract address`);
    console.log(`  [${addr}]`);
    return addr as Hex;
  }

  console.log('\n[2/8] Deploying BabyJubJub library...');
  const babyJubJubAddr = await deploy('BabyJubJub', babyJubJub);

  console.log('\n[3/8] Deploying five verifiers...');
  const registrationVAddr = await deploy('RegistrationVerifier', registrationV);
  const mintVAddr = await deploy('MintVerifier', mintV);
  const transferVAddr = await deploy('TransferVerifier', transferV);
  const withdrawVAddr = await deploy('WithdrawVerifier', withdrawV);
  const burnVAddr = await deploy('BurnVerifier', burnV);

  console.log('\n[4/8] Deploying Registrar...');
  const registrarAddr = await deploy('Registrar', registrar, [registrationVAddr]);

  const libs = { 'contracts/libraries/BabyJubJub.sol:BabyJubJub': babyJubJubAddr };

  console.log('\n[5/8] Deploying EncryptedERC (standalone)...');
  const standaloneAddr = await deploy('EncryptedERC-standalone', encryptedERC, [
    {
      registrar: registrarAddr,
      isConverter: false,
      name: 'Demo Private Token',
      symbol: 'PRIV',
      decimals: EERC_DECIMALS,
      mintVerifier: mintVAddr,
      withdrawVerifier: withdrawVAddr,
      transferVerifier: transferVAddr,
      burnVerifier: burnVAddr,
    },
  ], libs);

  console.log('\n[6/8] Deploying EncryptedERC (converter)...');
  const converterAddr = await deploy('EncryptedERC-converter', encryptedERC, [
    {
      registrar: registrarAddr,
      isConverter: true,
      name: '',
      symbol: '',
      decimals: EERC_DECIMALS,
      mintVerifier: mintVAddr,
      withdrawVerifier: withdrawVAddr,
      transferVerifier: transferVAddr,
      burnVerifier: burnVAddr,
    },
  ], libs);

  console.log('\n[7/8] Writing addresses to constants/eerc-deployments.json...');
  const deployedAtBlock = Number(await publicClient.getBlockNumber());
  const raw = await readFile(DEPLOYMENTS_PATH, 'utf8');
  const file = JSON.parse(raw);
  const fuji = file.deployments['43113'];
  const verifiers = {
    registration: registrationVAddr,
    mint: mintVAddr,
    transfer: transferVAddr,
    withdraw: withdrawVAddr,
    burn: burnVAddr,
  };

  fuji.standalone = {
    label: 'Demo Private Token (PRIV)',
    encryptedERC: standaloneAddr,
    registrar: registrarAddr,
    babyJubJubLibrary: babyJubJubAddr,
    verifiers,
    auditorAddress: '',
    decimals: EERC_DECIMALS,
    deployedAtBlock,
  };

  fuji.converter = {
    label: 'Demo Converter (wraps mUSDC + WAVAX)',
    encryptedERC: converterAddr,
    registrar: registrarAddr,
    babyJubJubLibrary: babyJubJubAddr,
    verifiers,
    auditorAddress: '',
    decimals: EERC_DECIMALS,
    deployedAtBlock,
    supportedTokens: [
      { address: FUJI_WAVAX, symbol: 'WAVAX', name: 'Wrapped AVAX (Fuji)', decimals: 18 },
    ],
  };

  await writeFile(DEPLOYMENTS_PATH, JSON.stringify(file, null, 2) + '\n');

  console.log('\n[8/8] Done. Next steps:');
  console.log('  1. Connect your wallet on Fuji and visit /console/encrypted-erc/register to register your BJJ key.');
  console.log('  2. Visit /console/encrypted-erc/deploy/auditor to set yourself (the registered deployer) as the auditor.');
  console.log('  3. Test Deposit / Transfer / Withdraw flows.\n');
  console.table({ babyJubJubAddr, registrationVAddr, mintVAddr, transferVAddr, withdrawVAddr, burnVAddr, registrarAddr, standaloneAddr, converterAddr });
}

main().catch((err) => {
  // Make sure we never leak the key if something deep in viem throws with it.
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg.replace(/0x[a-fA-F0-9]{64}/g, '0x<REDACTED>'));
  process.exit(1);
});
