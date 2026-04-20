// Centralised GitHub raw-URL sources for the eERC Solidity contracts we deploy.
// Pinned to a single commit in scripts/versions.json so the source you see on
// the right-hand pane of each deploy step always matches the bytecode we ship.

import type { ContractSource } from '@/components/console/contract-deploy-viewer';
import versions from '@/scripts/versions.json';

export const EERC_COMMIT = versions['ava-labs/EncryptedERC'];

const raw = (path: string) =>
  `https://raw.githubusercontent.com/ava-labs/EncryptedERC/${EERC_COMMIT}/${path}`;

export const BABYJUBJUB_SOURCES: ContractSource[] = [
  {
    name: 'BabyJubJub',
    filename: 'BabyJubJub.sol',
    url: raw('contracts/libraries/BabyJubJub.sol'),
    description: 'On-chain BabyJubJub curve operations — addition, scalar multiplication, and on-curve checks. Deployed once and linked into EncryptedERC via bytecode splicing.',
  },
];

export const REGISTRAR_SOURCES: ContractSource[] = [
  {
    name: 'Registrar',
    filename: 'Registrar.sol',
    url: raw('contracts/Registrar.sol'),
    description: 'Maps EVM addresses to BabyJubJub public keys. Every user registers exactly once; eERC operations read from here to encrypt amounts to counterparties.',
  },
  {
    name: 'IRegistrar',
    filename: 'IRegistrar.sol',
    url: raw('contracts/interfaces/IRegistrar.sol'),
    description: 'Registrar interface consumed by EncryptedERC during transfer / mint / withdraw / burn.',
  },
];

export const VERIFIER_SOURCES: ContractSource[] = [
  {
    name: 'Registration',
    filename: 'RegistrationCircuitGroth16Verifier.sol',
    url: raw('contracts/verifiers/RegistrationCircuitGroth16Verifier.sol'),
    description: 'Verifies the 5-public-signal registration proof that binds (BJJ pubkey, EVM address, chainId).',
  },
  {
    name: 'Mint',
    filename: 'MintCircuitGroth16Verifier.sol',
    url: raw('contracts/verifiers/MintCircuitGroth16Verifier.sol'),
    description: 'Verifies the 24-public-signal privateMint proof used in standalone mode.',
  },
  {
    name: 'Transfer',
    filename: 'TransferCircuitGroth16Verifier.sol',
    url: raw('contracts/verifiers/TransferCircuitGroth16Verifier.sol'),
    description: 'Verifies the 32-public-signal transfer proof — the heaviest circuit in the protocol.',
  },
  {
    name: 'Withdraw',
    filename: 'WithdrawCircuitGroth16Verifier.sol',
    url: raw('contracts/verifiers/WithdrawCircuitGroth16Verifier.sol'),
    description: 'Verifies the 16-public-signal withdraw proof; used in converter mode to unwrap back to public ERC20.',
  },
  {
    name: 'Burn',
    filename: 'BurnCircuitGroth16Verifier.sol',
    url: raw('contracts/verifiers/BurnCircuitGroth16Verifier.sol'),
    description: 'Verifies the 19-public-signal privateBurn proof; used in standalone mode.',
  },
];

export const ENCRYPTED_ERC_SOURCES: ContractSource[] = [
  {
    name: 'EncryptedERC',
    filename: 'EncryptedERC.sol',
    url: raw('contracts/EncryptedERC.sol'),
    description: 'The main contract — holds encrypted balances, verifies ZK proofs, stores per-tx auditor ciphertexts. Operates in either standalone or converter mode.',
  },
  {
    name: 'Types',
    filename: 'Types.sol',
    url: raw('contracts/types/Types.sol'),
    description: 'Shared struct definitions — EGCT, ProofPoints, RegisterProof, MintProof, TransferProof, WithdrawProof, BurnProof.',
  },
  {
    name: 'AuditorManager',
    filename: 'AuditorManager.sol',
    url: raw('contracts/auditor/AuditorManager.sol'),
    description: 'Tracks the current auditor address + public key; owner rotates via setAuditorPublicKey.',
  },
];

const ICM_COMMIT = versions['ava-labs/icm-contracts'];
const icmRaw = (path: string) =>
  `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/${path}`;

export const WAVAX_SOURCES: ContractSource[] = [
  {
    name: 'WrappedNativeToken',
    filename: 'WrappedNativeToken.sol',
    url: icmRaw('contracts/ictt/WrappedNativeToken.sol'),
    description: 'Canonical Wrapped AVAX (WAVAX) — deposit() wraps the native asset into an ERC20; withdraw() unwraps it. The Fuji WAVAX at 0xd00ae084... is deployed from this source.',
  },
];
