import versions from '@/scripts/versions.json';
import type { ContractSource } from '@/components/console/contract-deploy-viewer';

/**
 * Shared registry of `ContractSource` entries for the ICM network inspectors.
 * Each inspector imports a curated subset (e.g. `ICM_MESSENGER_SOURCES`) and
 * passes it to `<ContractDeployViewer>` so the right-side source pane shows
 * the relevant contract for that phase.
 *
 * URLs pinned to the same `ava-labs/icm-services` commit the legacy ICM
 * setup screens used. Keeping the anchor centralised here avoids drift when
 * the commit is bumped in `scripts/versions.json`.
 */
const ICM_COMMIT = versions['ava-labs/icm-services'];

const TELEPORTER_MESSENGER: ContractSource = {
  name: 'TeleporterMessenger',
  filename: 'TeleporterMessenger.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/TeleporterMessenger.sol`,
  description: 'Core ICM contract for cross-chain message sending and receiving.',
};

const ITELEPORTER_MESSENGER: ContractSource = {
  name: 'ITeleporterMessenger',
  filename: 'ITeleporterMessenger.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/ITeleporterMessenger.sol`,
  description: 'Interface defining the Teleporter messenger protocol.',
};

const TELEPORTER_REGISTRY: ContractSource = {
  name: 'TeleporterRegistry',
  filename: 'TeleporterRegistry.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistry.sol`,
  description: 'Registry contract for versioned Teleporter protocol management.',
};

const TELEPORTER_REGISTRY_APP: ContractSource = {
  name: 'TeleporterRegistryApp',
  filename: 'TeleporterRegistryApp.sol',
  url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/teleporter/registry/TeleporterRegistryApp.sol`,
  description: 'Base contract for apps that use the Teleporter Registry.',
};

/** Messenger phase — surfaces the core Teleporter contract and its interface. */
export const ICM_MESSENGER_SOURCES: ContractSource[] = [TELEPORTER_MESSENGER, ITELEPORTER_MESSENGER];

/** Registry phase — surfaces the Registry and its base app helper. */
export const ICM_REGISTRY_SOURCES: ContractSource[] = [TELEPORTER_REGISTRY, TELEPORTER_REGISTRY_APP];

/** Demo + Live phases — surfaces the ICMDemo contract (local repo) plus the
 *  upstream Messenger so the user can correlate the demo SDK calls with the
 *  on-chain entrypoint. ICMDemo isn't part of `icm-services`, so we point to
 *  the in-repo compiled artifact via the relative path. */
export const ICM_DEMO_SOURCES: ContractSource[] = [
  {
    name: 'TeleporterMessenger',
    filename: 'TeleporterMessenger.sol',
    url: TELEPORTER_MESSENGER.url,
    description: 'Underlying Teleporter contract the demo sends through.',
  },
];

export const ICM_CONTRACT_ANCHORS = {
  ICM_COMMIT,
  TELEPORTER_MESSENGER_URL: TELEPORTER_MESSENGER.url,
  ICM_RELAYER_REPO_URL: 'https://github.com/ava-labs/icm-services',
} as const;
