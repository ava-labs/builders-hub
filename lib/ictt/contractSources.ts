import versions from '@/scripts/versions.json';
import type { ContractSource } from '@/components/console/contract-deploy-viewer';

/**
 * Shared registry of `ContractSource` entries for the ICTT bridge inspectors.
 * Each inspector imports a curated subset (e.g. `ICTT_HOME_SOURCES`) and
 * passes it to `<ContractDeployViewer>` so the right-side source pane shows
 * the relevant contract for that phase.
 *
 * URLs pinned to the same `ava-labs/icm-services` commit the legacy ICTT
 * setup screens use (see `DeployTokenHome.tsx:24-42`, `DeployERC20TokenRemote.tsx:23-38`,
 * etc.). Keeping the anchor centralised here avoids drift when the commit
 * is bumped in `scripts/versions.json`.
 */
const ICM_COMMIT = versions['ava-labs/icm-services'];

const HOME_ERC20: ContractSource = {
  name: 'ERC20TokenHome',
  filename: 'ERC20TokenHome.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenHome/ERC20TokenHome.sol`,
  description: 'Home chain endpoint for ERC20 cross-chain transfers via ICTT.',
};

const HOME_NATIVE: ContractSource = {
  name: 'NativeTokenHome',
  filename: 'NativeTokenHome.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenHome/NativeTokenHome.sol`,
  description: 'Home chain endpoint for native token cross-chain transfers via ICTT.',
};

const REMOTE_ERC20: ContractSource = {
  name: 'ERC20TokenRemote',
  filename: 'ERC20TokenRemote.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenRemote/ERC20TokenRemote.sol`,
  description: 'Remote chain endpoint that mints wrapped tokens on delivery.',
};

const REMOTE_NATIVE: ContractSource = {
  name: 'NativeTokenRemote',
  filename: 'NativeTokenRemote.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/TokenRemote/NativeTokenRemote.sol`,
  description: 'Remote chain endpoint that mints native gas via the precompile on delivery.',
};

const EXAMPLE_ERC20: ContractSource = {
  name: 'ExampleERC20',
  filename: 'ExampleERC20.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/mocks/ExampleERC20.sol`,
  description: 'Mintable ERC-20 used as a test source token for bridge demos.',
};

const WRAPPED_NATIVE: ContractSource = {
  name: 'WrappedNativeToken',
  filename: 'WrappedNativeToken.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/ictt/mocks/WrappedNativeToken.sol`,
  description: 'WAVAX-style wrapped native contract — deposit to mint, withdraw to burn.',
};

/** Both Home variants — surfaced together on the Home phase so users can see
 *  ERC-20 and native side-by-side. */
export const ICTT_HOME_SOURCES: ContractSource[] = [HOME_ERC20, HOME_NATIVE];

/** Both Remote variants — surfaced together by default on the Remote phase
 *  when no specific kind is selected. */
export const ICTT_REMOTE_SOURCES: ContractSource[] = [REMOTE_ERC20, REMOTE_NATIVE];

/** Single-source pane variants for the Remote phase. The v2 wizard switches
 *  between these once the user has picked a remote kind, so the source pane
 *  matches the contract the deploy form is configured to ship. */
export const ICTT_REMOTE_ERC20_SOURCES: ContractSource[] = [REMOTE_ERC20];
export const ICTT_REMOTE_NATIVE_SOURCES: ContractSource[] = [REMOTE_NATIVE];

/** Register phase calls `registerWithHome` on the Remote and arrives on the
 *  Home — surface both sides of the registration handshake. */
export const ICTT_HOME_PLUS_REMOTE_SOURCES: ContractSource[] = [HOME_ERC20, REMOTE_ERC20];

/** Live (send) phase — both Home variants since `send` lives on either. */
export const ICTT_HOME_SEND_SOURCES: ContractSource[] = [HOME_ERC20, HOME_NATIVE];

/** Collateral phase — only the Home holds collateral. */
export const ICTT_COLLATERAL_SOURCES: ContractSource[] = [HOME_ERC20];

/** Token phase — three modes; each maps to one source list. */
export const ICTT_EXAMPLE_ERC20_SOURCES: ContractSource[] = [EXAMPLE_ERC20];
export const ICTT_WRAPPED_NATIVE_SOURCES: ContractSource[] = [WRAPPED_NATIVE];
