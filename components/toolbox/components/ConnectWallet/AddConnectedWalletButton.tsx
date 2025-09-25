import { Wallet } from 'lucide-react';
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
    return (source as string[]).some(addr => addr.toLowerCase() === lowerAddress);
  }
  
  // Array of objects with address property
  if (Array.isArray(source) && source.length > 0 && typeof source[0] === 'object') {
    return (source as { address: string }[]).some(obj => obj.address.toLowerCase() === lowerAddress);
  }
  
  // Object with arrays (like roles: Admin, Manager, Enabled)
  if (!Array.isArray(source) && typeof source === 'object') {
    return Object.values(source).some(arr => 
      Array.isArray(arr) && arr.some((item: any) => 
        item.address?.toLowerCase() === lowerAddress
      )
    );
  }
  
  return false;
}

export function AddConnectedWalletButton({ 
  onAddAddress, 
  checkDuplicate,
  addressSource,
  buttonText = "Add Connected Wallet",
  className = "",
  variant = "secondary",
  size = "sm"
}: AddConnectedWalletButtonProps) {
  const { walletEVMAddress } = useWalletStore();
  
  const handleClick = () => {
    if (walletEVMAddress) {
      onAddAddress(walletEVMAddress);
    }
  };

  // Use provided checkDuplicate or auto-check using addressSource
  const isDuplicate = walletEVMAddress ? 
    (checkDuplicate ? checkDuplicate(walletEVMAddress) : 
     addressSource ? checkAddressInSource(walletEVMAddress, addressSource) : false) : false;
  
  const isDisabled = !walletEVMAddress || isDuplicate;
  
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
  buttonText = "Add Wallet",
  className = ""
}: Omit<AddConnectedWalletButtonProps, 'variant' | 'size'>) {
  const { walletEVMAddress } = useWalletStore();
  
  const handleClick = () => {
    if (walletEVMAddress) {
      onAddAddress(walletEVMAddress);
    }
  };

  // Use provided checkDuplicate or auto-check using addressSource
  const isDuplicate = walletEVMAddress ? 
    (checkDuplicate ? checkDuplicate(walletEVMAddress) : 
     addressSource ? checkAddressInSource(walletEVMAddress, addressSource) : false) : false;
  
  const isDisabled = !walletEVMAddress || isDuplicate;
  
  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`px-3 py-1.5 bg-zinc-600 hover:bg-zinc-700 text-white text-sm rounded-md disabled:opacity-50 transition-colors font-medium flex items-center gap-1.5 ${className}`}
      title={isDisabled && walletEVMAddress && checkDuplicate ? "Address already added" : "Add connected wallet address"}
    >
      <Wallet className="h-3.5 w-3.5" />
      {buttonText}
    </button>
  );
}
