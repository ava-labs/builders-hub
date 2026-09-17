/**
 * Canonical platform-cli command surface — the single source of truth for the
 * command strings emitted by `build_plan` and shown as `equivalentCli` in
 * `console_flow`. Keeping them here stops the three former copies (actions.ts,
 * console.ts, docs.ts) from drifting.
 *
 * Every string below is a full command line and starts with the installed binary
 * name, `platform-cli`. There is no `platform` executable to invoke.
 *
 * platform-cli v2.0.0 renames several P-Chain commands to mirror the avalanchego
 * tx types (breaking). platform-cli `main` now ships these v2 names, so we DEFAULT
 * to v2 and gate v1 behind PLATFORM_CLI_MAJOR: flip the constant back to 1 to target
 * an old v1 install, and every emitted command updates in one place.
 */

export const PLATFORM_CLI_MAJOR: 1 | 2 = 2;

function pick(v1: string, v2: string): string {
  return PLATFORM_CLI_MAJOR >= 2 ? v2 : v1;
}

export const CLI = {
  keysGenerate: 'platform-cli keys generate',
  nodeInfo: 'platform-cli node info',
  subnetCreate: 'platform-cli subnet create',
  chainCreate: 'platform-cli chain create',
  subnetConvertL1: pick('platform-cli subnet convert-l1', 'platform-cli subnet convert-to-l1'),
  subnetAddValidator: 'platform-cli subnet add-validator', // v2 net-new (permissioned subnet validator)
  l1RegisterValidator: 'platform-cli l1 register-validator',
  l1SetWeight: pick('platform-cli l1 set-weight', 'platform-cli l1 set-validator-weight'),
  l1AddBalance: pick('platform-cli l1 add-balance', 'platform-cli l1 increase-validator-balance'),
  l1DisableValidator: 'platform-cli l1 disable-validator',
  validatorAdd: pick('platform-cli validator add', 'platform-cli validator add-permissionless'),
  validatorDelegate: pick('platform-cli validator delegate', 'platform-cli validator add-permissionless-delegator'),
  transferSend: 'platform-cli transfer send',
  transferPtoC: 'platform-cli transfer p-to-c',
  transferCtoP: 'platform-cli transfer c-to-p',
} as const;

export const PLATFORM_CLI_DOCS = 'https://build.avax.network/docs/tooling/platform-cli';
