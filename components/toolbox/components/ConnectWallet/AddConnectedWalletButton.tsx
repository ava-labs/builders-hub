import { useEffect, useRef } from 'react';
import { Wallet } from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '../Button';

type AddressSource = string[] | { address: string }[] | { [key: string]: { address: string }[] };

interface AddConnectedWalletButtonProps {
  onAddAddress: (address: string) => void;
  checkDuplicate?: (address: string) => boolean;
  addressSource?: AddressSource; // For automatic duplicate checking
  buttonText?: string;
  className?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'lg' | 'default';
}

/**
 * A button component that adds the connected wallet address to a list or input.
 *
 * @param onAddAddress - Callback function to handle adding the address
 * @param checkDuplicate - Optional function to check if address already exists
 * @param buttonText - Optional custom button text (default: "Add Wallet")
 * @param className - Optional additional CSS classes
 * @param variant - Button variant (default: "secondary")
 * @param size - Button size: "sm", "lg", or "default" (default: "sm")
 */
// Helper function to check duplicates in various data structures
function checkAddressInSource(address: string, source: AddressSource): boolean {
  const lowerAddress = address.toLowerCase();

  // Array of strings
  if (Array.isArray(source) && source.length > 0 && typeof source[0] === 'string') {
    return (source as string[]).some((addr) => addr.toLowerCase() === lowerAddress);
  }

  // Array of objects with address property
  if (Array.isArray(source) && source.length > 0 && typeof source[0] === 'object') {
    return (source as { address: string }[]).some((obj) => obj.address.toLowerCase() === lowerAddress);
  }

  // Object with arrays (like roles: Admin, Manager, Enabled)
  if (!Array.isArray(source) && typeof source === 'object') {
    return Object.values(source).some(
      (arr) => Array.isArray(arr) && arr.some((item: any) => item.address?.toLowerCase() === lowerAddress),
    );
  }

  return false;
}

type InjectedProvider = { request?: (args: { method: string }) => Promise<unknown> };

/**
 * Click behavior shared by both button variants: with a wallet connected the
 * address is added directly; without one, clicking opens the wallet connect
 * prompt and the address is added automatically once the user approves.
 */
function useAddOrConnect({
  connectedAddress,
  isDuplicate,
  onAddAddress,
}: {
  connectedAddress: string | null | undefined;
  isDuplicate: boolean;
  onAddAddress: (address: string) => void;
}) {
  const { openConnectModal } = useConnectModal();
  const pendingAddRef = useRef(false);

  useEffect(() => {
    if (!pendingAddRef.current || !connectedAddress) return;
    pendingAddRef.current = false;
    if (!isDuplicate) onAddAddress(connectedAddress);
  }, [connectedAddress, isDuplicate, onAddAddress]);

  return () => {
    if (connectedAddress) {
      onAddAddress(connectedAddress);
      return;
    }
    pendingAddRef.current = true;
    if (openConnectModal) {
      openConnectModal();
      return;
    }
    // Outside the RainbowKit provider tree (e.g. embedded docs tools) fall
    // back to requesting accounts straight from the injected wallet.
    const injected = window as { avalanche?: InjectedProvider; ethereum?: InjectedProvider };
    const provider = injected.avalanche ?? injected.ethereum;
    void provider?.request?.({ method: 'eth_requestAccounts' }).catch(() => {
      pendingAddRef.current = false;
    });
  };
}

export function AddConnectedWalletButton({
  onAddAddress,
  checkDuplicate,
  addressSource,
  buttonText = 'Add Connected Wallet',
  className = '',
  variant = 'secondary',
  size = 'sm',
}: AddConnectedWalletButtonProps) {
  const { walletEVMAddress, coreEthAddress } = useWalletStore();
  const connectedAddress = walletEVMAddress || coreEthAddress;

  // Use provided checkDuplicate or auto-check using addressSource
  const isDuplicate = connectedAddress
    ? checkDuplicate
      ? checkDuplicate(connectedAddress)
      : addressSource
        ? checkAddressInSource(connectedAddress, addressSource)
        : false
    : false;

  const handleClick = useAddOrConnect({ connectedAddress, isDuplicate, onAddAddress });

  // Without a wallet the button stays clickable so it can prompt the connect
  // flow; it only disables once the connected address is already in the list.
  const isDisabled = Boolean(connectedAddress) && isDuplicate;

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={`flex items-center gap-1.5 ${className}`}
    >
      <Wallet className="h-3.5 w-3.5" />
      {buttonText}
    </Button>
  );
}

/**
 * A simple button variant without using the Button component, for inline use.
 *
 * @param onAddAddress - Callback function to handle adding the address
 * @param checkDuplicate - Optional function to check if address already exists
 * @param buttonText - Optional custom button text (default: "Add Wallet")
 * @param className - Optional additional CSS classes
 */
export function AddConnectedWalletButtonSimple({
  onAddAddress,
  checkDuplicate,
  addressSource,
  buttonText = 'Add Wallet',
  className = '',
}: Omit<AddConnectedWalletButtonProps, 'variant' | 'size'>) {
  const { walletEVMAddress, coreEthAddress } = useWalletStore();
  const connectedAddress = walletEVMAddress || coreEthAddress;

  // Use provided checkDuplicate or auto-check using addressSource
  const isDuplicate = connectedAddress
    ? checkDuplicate
      ? checkDuplicate(connectedAddress)
      : addressSource
        ? checkAddressInSource(connectedAddress, addressSource)
        : false
    : false;

  const handleClick = useAddOrConnect({ connectedAddress, isDuplicate, onAddAddress });

  // Without a wallet the button stays clickable so it can prompt the connect
  // flow; it only disables once the connected address is already in the list.
  const isDisabled = Boolean(connectedAddress) && isDuplicate;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`px-3 py-1.5 bg-zinc-600 hover:bg-zinc-700 text-white text-sm rounded-md disabled:opacity-50 transition-colors font-medium flex items-center gap-1.5 ${className}`}
      title={
        isDisabled
          ? 'Address already added'
          : connectedAddress
            ? 'Add connected wallet address'
            : 'Connect a wallet to add its address'
      }
    >
      <Wallet className="h-3.5 w-3.5" />
      {buttonText}
    </button>
  );
}
