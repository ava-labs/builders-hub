import { describe, expect, it } from 'vitest';
import { calloutMarks, opensWithLabelWord, resolveCalloutKind } from '@/lib/academy/callout-label';

// Openings copied from content/academy: the title attribute, then the first text of the body.
const LABELS_ITSELF = [
  ["Note: Later in this course, you'll need to run your own Docker-hosted validator to perform network upgrades.", 'access-restriction/02-genesis-activation/02-create-l1.mdx:98'],
  ['Important: Your Docker validator will become the primary node for this exercise.', 'access-restriction/05-network-upgrade-de-activation/02-setup-docker-validator.mdx:23'],
  ['Remember that you need to be connected to the Fuji testnet to see and interact with your token.', 'erc20-bridge/03-erc-20-to-erc-20-bridge/02-deploy-erc-20-token.mdx:42'],
  ["Remember, we're still configuring the genesis for our L1", 'l1-native-tokenomics/04-native-minter/03-activate-native-minter.mdx:11'],
  ['Remember, when restarting your Avalanche Starter Kit Codespace, you should restart your Avalanche network', 'blockchain/solidity-foundry/03-smart-contracts/04-create-new-smart-contract.mdx:11'],
  ["Note Keep this address handy as you'll need it for the next steps in the bridging process.", 'erc20-bridge/03-erc-20-to-erc-20-bridge/03-deploy-home.mdx:35, title "Note"'],
  ['Warning Never use this address or private key for anything other than testing on a local test network.', 'customizing-evm/05-genesis-configuration/07-initial-token-allocation.mdx:41, title "Warning"'],
  ['Warning about gasLimit If you do decide to set your own gasLimit,', 'customizing-evm/05-genesis-configuration/02-create-your-genesis.mdx:68, title'],
] as const;

const DOES_NOT = [
  ['Is PoA Manager Required?', 'permissioned-l1s/06-multisig-setup/01-poa-manager.mdx:93'],
  ['Save the Teleporter Registry address', 'interchain-messaging/04-icm-setup/03-deploy-teleporter-registry.mdx:31'],
  ["This conversion is irreversible. Double-check you're converting the correct Subnet.", 'access-restriction/02-genesis-activation/02-create-l1.mdx:72'],
  ['Key Insight: You can be blocked from sending ANY transaction without ever interacting with the precompile', 'access-restriction/03-precompile-flow/02-automatic-enforcement.mdx:26'],
  ['Critical: The metadata file must NOT have a .json extension when uploaded to Pinata.', 'blockchain/nft-deployment/02-prepare-nft-files.mdx:119'],
  ['The relayer needs sufficient funds on both chains to deliver messages in both directions', 'interchain-messaging/06-relayer-deep-dive/01-relayer-configuration.mdx:141, title'],
  ['Reminder: You received 1 USDC from the Circle Faucet at the start of this chapter.', 'native-token-bridge/01-erc20-to-native/07-bridge-tokens.mdx:18'],
  ['Notes on the setup', 'word boundary'],
  ['Importantly, the relayer', 'word boundary'],
  ['Tipping the balance', 'word boundary'],
] as const;

describe('resolveCalloutKind (fumadocs-ui callout.js:8-14)', () => {
  it('resolves a missing type to info, warn to warning and tip to info', () => {
    expect(resolveCalloutKind(undefined)).toBe('info');
    expect(resolveCalloutKind('warn')).toBe('warning');
    expect(resolveCalloutKind('tip')).toBe('info');
    expect(resolveCalloutKind('warning')).toBe('warning');
    expect(resolveCalloutKind('quote')).toBe('quote');
  });

  it('returns null for a type fumadocs has no style for', () => {
    expect(resolveCalloutKind('infor')).toBeNull();
  });
});

describe('opensWithLabelWord', () => {
  it.each(LABELS_ITSELF)('labels itself: %s (%s)', (opening) => {
    expect(opensWithLabelWord(opening)).toBe(true);
  });

  it.each(DOES_NOT)('does not label itself: %s (%s)', (opening) => {
    expect(opensWithLabelWord(opening)).toBe(false);
  });
});

describe('calloutMarks', () => {
  it('gives each kind its label', () => {
    expect(calloutMarks('info', 'Is PoA Manager Required?')).toEqual({ kind: 'info', label: 'Note' });
    expect(calloutMarks(undefined, 'Make sure you have:')).toEqual({ kind: 'info', label: 'Note' });
    expect(calloutMarks('warn', 'This conversion is irreversible.')).toEqual({ kind: 'warning', label: 'Caution' });
    expect(calloutMarks('error', 'Deleting the key')).toEqual({ kind: 'error', label: 'Important' });
    expect(calloutMarks('success', 'Your node is synced')).toEqual({ kind: 'success', label: 'Tip' });
    expect(calloutMarks('idea', 'Try a second validator')).toEqual({ kind: 'idea', label: 'Caution' });
  });

  it('keeps the kind and drops the label when the callout labels itself', () => {
    expect(calloutMarks('info', "Note: Later in this course, you'll need")).toEqual({ kind: 'info', label: null });
  });

  it('gives a quote no label', () => {
    expect(calloutMarks('quote', 'The most effective ways of communicating market potential')).toEqual({ kind: 'quote', label: null });
  });

  it('returns null for a type fumadocs has no style for', () => {
    expect(calloutMarks('infor', 'Save the Teleporter Registry address')).toBeNull();
  });
});
