// Shown while useVMCAddress resolves the signing subnet. Signing before then asks the wrong validators.
export const SIGNING_SUBNET_LOADING = 'Loading the Validator Manager details...';

/**
 * The text for a failed Validator Manager lookup. useVMCAddress does not retry it: it runs again only when the L1,
 * the wallet chain or the network changes. Selecting the same L1 again changes nothing, so the text asks for a reload
 * or another L1.
 */
export function signingSubnetErrorText(error: string): string {
  // A Glacier error over HTTP/2 has no status text, so it can end in ': '
  return (
    `Could not load the Validator Manager details: ${error.replace(/[\s.:]+$/, '').trim()}. ` +
    'Reload the page to try again, or select another L1.'
  );
}

/** The reason a step that signs a Warp message cannot start, or null when the signing subnet is known. */
export function signingSubnetWaitText(
  signingSubnetId: string | undefined,
  isLoading: boolean,
  error: string | null | undefined,
): string | null {
  if (signingSubnetId) return null;
  if (error && !isLoading) return signingSubnetErrorText(error);
  return SIGNING_SUBNET_LOADING;
}

interface SigningSubnetStatusProps {
  signingSubnetId: string | undefined;
  isLoading: boolean;
  error: string | null | undefined;
  className?: string;
}

/**
 * Tells the user why a signing step waits: the loading text while useVMCAddress loads, and the lookup error as an
 * alert when it failed. Shows nothing when the signing subnet is known.
 */
export function SigningSubnetStatus({ signingSubnetId, isLoading, error, className = '' }: SigningSubnetStatusProps) {
  if (signingSubnetId) return null;
  if (error && !isLoading) {
    return (
      <p role="alert" className={`text-xs text-red-600 dark:text-red-400 ${className}`}>
        {signingSubnetErrorText(error)}
      </p>
    );
  }
  if (!isLoading) return null;
  return <p className={`text-xs text-zinc-500 dark:text-zinc-400 ${className}`}>{SIGNING_SUBNET_LOADING}</p>;
}
