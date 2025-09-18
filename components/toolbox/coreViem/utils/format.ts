/**
 * Formats a numerical AVAX balance (in nAVAX) to a human-readable string with AVAX denomination
 * @param balance - The balance in nAVAX (nano AVAX, 1 AVAX = 10^9 nAVAX)
 * @returns Formatted balance string with AVAX denomination
 */
export function formatAvaxBalance(balance: number | bigint): string {
    const balanceNum = typeof balance === 'bigint' ? Number(balance) : balance;
    return (
        (balanceNum / 1_000_000_000).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }) + " AVAX"
    );
} 