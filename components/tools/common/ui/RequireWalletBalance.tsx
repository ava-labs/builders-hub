import { useState, useEffect, ReactNode } from "react";
import { Chain } from "viem";

// RequireWalletBalance Props
interface RequireWalletBalanceProps {
  account: string | null;
  chain: Chain;
  requiredBalance: number;
  children: ReactNode;
}

// RequireWalletBalance Component
export const RequireWalletBalance = ({
  account,
  chain,
  requiredBalance,
  children,
}: RequireWalletBalanceProps) => {
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account && requiredBalance && requiredBalance > 0) {
      checkBalance();
    }
  }, [account, requiredBalance]);

  const checkBalance = async () => {
    try {
      if (!account || !chain?.rpcUrls?.default?.http?.[0]) return;

      const response = await fetch(chain.rpcUrls.default.http[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [account, "latest"],
          id: 1,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setError(`Error requesting balance: ${data.error.message}`);
        return;
      }

      const balance = parseInt(data.result, 16) / 1e18;
      setAccountBalance(balance);

      if (balance < requiredBalance!) {
        setError(
          `Insufficient balance: ${balance.toFixed(4)} ${chain.nativeCurrency.symbol} < ${requiredBalance} ${chain.nativeCurrency.symbol}`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(`Connection error: ${error.message}`);
      } else {
        setError(`An unknown error occurred: ${error}`);
      }
    }
  };

  if (!account || !requiredBalance || requiredBalance <= 0) return children || null;

  if (error) {
    return (
      <div className="text-red-500 mb-4">
        {error}
        <button
          onClick={checkBalance}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-4"
        >
          Check Again
        </button>
      </div>
    );
  }

  if (accountBalance === null) return null;

  if (accountBalance < requiredBalance) {
    return (
      <div className="text-red-500 mb-4">
        <p>
          The balance of the account {account} is {accountBalance?.toFixed(4)}{" "}
          {chain.nativeCurrency.symbol}. That is lower than the required balance of{" "}
          {requiredBalance} {chain.nativeCurrency.symbol}. Please fund your account to proceed.
        </p>
        <button
          onClick={checkBalance}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-4"
        >
          Check Again
        </button>
      </div>
    );
  }

  return children || null;
};
