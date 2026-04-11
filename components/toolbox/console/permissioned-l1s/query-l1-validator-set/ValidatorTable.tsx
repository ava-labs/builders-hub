'use client';

import { Loader2, Calendar, Search, Users, Copy, Check } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { Tooltip } from '@/components/toolbox/components/Tooltip';
import { formatAvaxBalance } from '@/components/toolbox/coreViem/utils/format';
import { ValidatorResponse, formatTimestamp, formatStake } from './types';

interface ValidatorTableProps {
  validators: ValidatorResponse[];
  filteredValidators: ValidatorResponse[];
  searchTerm: string;
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onViewDetails: (validator: ValidatorResponse) => void;
  copyToClipboard: (text: string) => void;
  copiedId: string | null;
  isLoading: boolean;
}

export function ValidatorTable({
  validators,
  filteredValidators,
  searchTerm,
  onSearch,
  onViewDetails,
  copyToClipboard,
  copiedId,
  isLoading,
}: ValidatorTableProps) {
  if (validators.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 mt-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center">
          <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 flex items-center">
            Validator List
            <span className="ml-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium px-2 py-0.5 rounded-full">
              {validators.length}
            </span>
          </h3>
        </div>

        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={onSearch}
            placeholder="Search by Node ID..."
            className="pl-9 w-full py-1.5 px-3 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 focus:border-transparent text-zinc-800 dark:text-zinc-200"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mb-2" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading validators...</p>
        </div>
      ) : filteredValidators.length > 0 ? (
        <div className="rounded-xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200/80 dark:divide-zinc-800">
              <thead>
                <tr className="bg-zinc-50/80 dark:bg-zinc-800/50">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Node ID
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    AVAX Balance
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Weight
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200/80 dark:divide-zinc-800">
                {filteredValidators.map((validator, index) => (
                  <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-150">
                    <td className="px-3 py-3 text-sm font-mono truncate max-w-[180px] text-zinc-800 dark:text-zinc-200">
                      <div className="flex items-center">
                        <span title={validator.nodeId} className="truncate">
                          {validator.nodeId.substring(0, 14)}...
                        </span>
                        <button
                          onClick={() => copyToClipboard(validator.nodeId)}
                          className="ml-1.5 p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <Tooltip content={copiedId === validator.nodeId ? 'Copied!' : 'Copy Node ID'}>
                            {copiedId === validator.nodeId ? (
                              <Check size={12} className="text-green-500" />
                            ) : (
                              <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                            )}
                          </Tooltip>
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {formatAvaxBalance(parseFloat(validator.remainingBalance))}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                      <span className="font-medium">{formatStake(validator.weight.toString())}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center">
                        <Calendar size={12} className="mr-1 text-zinc-400 dark:text-zinc-500" />
                        <span className="text-xs">{formatTimestamp(validator.creationTimestamp)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Button variant="outline" size="sm" onClick={() => onViewDetails(validator)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : searchTerm ? (
        <div className="flex flex-col items-center justify-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <Search className="h-6 w-6 text-zinc-400 mb-2" />
          <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No matching validators</p>
          <p className="text-zinc-500 dark:text-zinc-500 text-xs">Try a different search term</p>
        </div>
      ) : (
        <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <Users className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
          <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No validators found</p>
          <p className="text-zinc-500 dark:text-zinc-500 text-xs">
            Try changing the subnet ID or check your network connection
          </p>
        </div>
      )}
    </div>
  );
}
