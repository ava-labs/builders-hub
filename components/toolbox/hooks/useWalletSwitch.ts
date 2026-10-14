import { useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useSwitchChain } from 'wagmi';
import { networkIDs } from '@avalabs/avalanchejs';
import { toast } from '@/lib/toast';
import type { L1ListItem } from '../stores/l1ListStore';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';

/** The text of a network switch that the user rejected in the wallet: the one Console text for a wallet rejection. */
export const SWITCH_REJECTED_MESSAGE = WALLET_REJECTED_TEXT;

/**
 * True when the wallet reports that the user refused the request (EIP-1193
 * code 4001). viem and wagmi wrap the wallet error, so walk the cause chain.
 */
export function isUserRejection(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && typeof current === 'object' && depth < 6; depth++) {
    if ((current as { code?: unknown }).code === 4001) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return err instanceof Error && /user rejected|user denied/i.test(err.message);
}

/**
 * Shows one plain toast for a failed network switch. A refusal gets the
 * rejection text. Other errors get viem's one-line `shortMessage`, never the
 * full multi-line `message` with request details and the viem version.
 */
export function toastSwitchFailure(err: unknown, chainId: number, chainName?: string) {
  const id = `network-switch:${chainId}`;
  if (isUserRejection(err)) {
    toast.error(SWITCH_REJECTED_MESSAGE, undefined, { id });
    return;
  }
  const title = chainName ? `Your wallet did not switch to ${chainName}.` : 'Your wallet did not switch the network.';
  const shortMessage = (err as { shortMessage?: unknown } | null)?.shortMessage;
  toast.error(title, typeof shortMessage === 'string' ? shortMessage : undefined, { id });
}

/** Options of a network switch. */
export interface SwitchOptions {
  /**
   * Show a toast when the wallet does not switch. Default true. Pass false when the caller shows its own next step
   * (ChainGate opens the Add Chain modal) or when no user action started the switch (AutoSwitchChainGate on load).
   */
  toastOnFailure?: boolean;
}

/** Logs a failed switch and, unless the caller turned it off, shows the toast. Returns false, the switch result. */
export function reportSwitchFailure(
  err: unknown,
  chainId: number,
  { toastOnFailure = true }: SwitchOptions = {},
  chainName?: string,
): false {
  console.warn(`switchChain to ${chainId} failed:`, err);
  if (toastOnFailure) toastSwitchFailure(err, chainId, chainName);
  return false;
}

export function useWalletSwitch() {
  // Granular selectors so this hook only re-renders when fields it actually
  // reads change. A full-store destructure (`const { ... } = useWalletStore()`)
  // tore down the memoization below on every unrelated wallet field update,
  // which then handed unstable function references to consumers, for example the
  // ICTT RemoteInspector's auto-switch useEffect kept re-firing because
  // `switchChainOrAdd` was a new reference each render.
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId);
  const setIsTestnet = useWalletStore((s) => s.setIsTestnet);
  const setAvalancheNetworkID = useWalletStore((s) => s.setAvalancheNetworkID);
  const { switchChainAsync } = useSwitchChain();

  /**
   * Switches the wallet to `chainId`. Returns true when the wallet switched.
   * A failure shows a toast (unless `options.toastOnFailure` is false) and
   * returns false; it never throws.
   */
  const safelySwitch = useCallback(
    async (chainId: number, testnet: boolean, options?: SwitchOptions): Promise<boolean> => {
      try {
        if (coreWalletClient) {
          await coreWalletClient.switchChain({ id: chainId });
        } else {
          // Fallback for generic EVM wallets via wagmi
          await switchChainAsync({ chainId });
        }
      } catch (e) {
        return reportSwitchFailure(e, chainId, options);
      }
      setWalletChainId(chainId);
      setIsTestnet(testnet);
      setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
      return true;
    },
    [coreWalletClient, setWalletChainId, setIsTestnet, setAvalancheNetworkID, switchChainAsync],
  );

  /**
   * Switch to an L1, falling back to `wallet_addEthereumChain` when the wallet
   * rejects the switch (most commonly because it hasn't been added yet).
   *
   * Use this from any UI that hands the user a button to "switch to <L1>"
   * where the L1 may or may not already be in the wallet, for example the ICTT
   * bridge's chain pickers and phase gate. The plain `safelySwitch` above
   * only switches: for an unknown chain it shows a toast and returns false.
   *
   * Surfaces a `toast.error` if both attempts fail so the user isn't left
   * staring at an unresponsive button. `options.toastOnFailure: false` turns
   * the toast off.
   */
  const safelySwitchOrAdd = useCallback(
    async (l1: L1ListItem, options?: SwitchOptions): Promise<boolean> => {
      const sync = () => {
        setWalletChainId(l1.evmChainId);
        setIsTestnet(Boolean(l1.isTestnet));
        setAvalancheNetworkID(l1.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
      };

      // Cheap path first: works when the chain is already in the wallet.
      if (coreWalletClient) {
        try {
          await coreWalletClient.switchChain({ id: l1.evmChainId });
          sync();
          return true;
        } catch (switchErr) {
          // Most wallets throw a "chain not added" error here. Try to add it
          // using the L1 metadata, which both adds AND switches in one prompt.
          try {
            await coreWalletClient.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${l1.evmChainId.toString(16)}`,
                  chainName: l1.name,
                  nativeCurrency: { name: l1.coinName, symbol: l1.coinName, decimals: 18 },
                  rpcUrls: [l1.rpcUrl],
                  // Core's proprietary flag. Other wallets ignore it.
                  isTestnet: Boolean(l1.isTestnet),
                },
              ] as never,
            });
            // Some wallets auto-switch on add; call switchChain again to be sure.
            try {
              await coreWalletClient.switchChain({ id: l1.evmChainId });
            } catch {
              // Ignore: the wallet may have already switched during the add.
            }
            sync();
            return true;
          } catch (addErr) {
            // A refusal of either prompt is a refusal of the switch.
            return reportSwitchFailure(
              isUserRejection(switchErr) ? switchErr : addErr,
              l1.evmChainId,
              options,
              l1.name,
            );
          }
        }
      }

      // Generic EVM wallet via wagmi: switchChainAsync handles add-on-demand
      // for chains that are registered in wagmiConfig.
      try {
        await switchChainAsync({ chainId: l1.evmChainId });
        sync();
        return true;
      } catch (e) {
        return reportSwitchFailure(e, l1.evmChainId, options, l1.name);
      }
    },
    [coreWalletClient, setWalletChainId, setIsTestnet, setAvalancheNetworkID, switchChainAsync],
  );

  return {
    safelySwitch,
    safelySwitchOrAdd,
  };
}
