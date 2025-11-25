import React from 'react';
import { Copy, Users, Shield, Hash, CheckCircle } from 'lucide-react';

interface MultisigInfoProps {
  safeInfo: {
    address: string;
    threshold: number;
    owners: string[];
    version: string;
    nonce: number;
  };
  walletAddress: string;
}

export const MultisigInfo: React.FC<MultisigInfoProps> = ({ safeInfo, walletAddress }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 p-4 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/30 rounded-lg p-2.5 h-[60px] w-[60px] flex items-center justify-center flex-shrink-0 shadow-sm dark:shadow-zinc-900/50">
            <img 
              src="/images/ash.png" 
              alt="Ash" 
              className="h-8 w-auto"
            />
          </div>
          <div className="flex flex-col justify-center h-[60px]">
            <h3 className="text-base font-semibold mb-1 mt-0 text-zinc-800 dark:text-zinc-100">
              Ash Wallet Multisig
            </h3>
            <p className="text-xs mt-0 mb-0 text-zinc-500 dark:text-zinc-400">
              Safe multisig wallet information
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Safe Address */}
        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Safe Address
            </span>
            <button
              onClick={() => copyToClipboard(safeInfo.address)}
              className="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="font-mono text-sm break-all text-gray-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 p-3 rounded border dark:border-zinc-600">
            {safeInfo.address}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">Threshold</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
              {safeInfo.threshold}
            </div>
            <div className="text-xs text-gray-600 dark:text-zinc-400">
              of {safeInfo.owners.length} owners
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Hash className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">Nonce</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
              {safeInfo.nonce}
            </div>
            <div className="text-xs text-gray-600 dark:text-zinc-400">
              Current transaction
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Shield className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">Version</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
              {safeInfo.version || 'N/A'}
            </div>
            <div className="text-xs text-gray-600 dark:text-zinc-400">
              Safe contract
            </div>
          </div>
        </div>

        {/* Owners */}
        <div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Owners ({safeInfo.owners.length})
          </h4>
          <div className="space-y-3">
            {safeInfo.owners.map((owner: string, index: number) => {
              const isCurrentUser = owner.toLowerCase() === walletAddress.toLowerCase();
              return (
                <div 
                  key={owner} 
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isCurrentUser 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                      : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isCurrentUser 
                        ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' 
                        : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-mono text-sm break-all text-gray-900 dark:text-zinc-100">
                        {shortenAddress(owner)}
                      </div>
                      <div className="font-mono text-xs text-gray-500 dark:text-zinc-400">
                        {owner}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isCurrentUser && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        You
                      </span>
                    )}
                    <button
                      onClick={() => copyToClipboard(owner)}
                      className="text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
