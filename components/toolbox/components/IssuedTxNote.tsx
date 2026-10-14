/** The note for a P-Chain tx that was issued but not confirmed. Every Console tool uses this one text. */
export const ISSUED_TX_NOTE =
  'This transaction was issued and may still commit. Check it in the explorer before you send it again.';

/** The note and a link to the tx in the explorer. Show it only for a tx that the P-Chain did not drop. */
export function IssuedTxNote({ txId, isTestnet, className }: { txId: string; isTestnet: boolean; className?: string }) {
  const explorerUrl = `/explorer/${isTestnet ? 'fuji' : 'mainnet'}/p-chain/tx/${txId}`;
  return (
    <p className={className}>
      {ISSUED_TX_NOTE}{' '}
      <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">
        View transaction in the explorer
      </a>
    </p>
  );
}
