'use client';

import { useState, useEffect } from 'react';
import { networkIDs } from '@avalabs/avalanchejs';
import { getBlockchainInfo, getSubnetInfo } from '@/components/toolbox/coreViem/utils/glacier';
import InputSubnetId from '@/components/toolbox/components/InputSubnetId';
import BlockchainDetailsDisplay from '@/components/toolbox/components/BlockchainDetailsDisplay';
import { Board, BoardHeader } from '@/components/explorer-v2/ui';
import { Loader2, X } from 'lucide-react';
import { HoverArrow, PRIMARY_BTN } from './ui';

interface CreateNodeFormProps {
  onClose: () => void;
  onSubmit: (subnetId: string, blockchainId: string) => void;
  onError: (title: string, message: string, isLoginError?: boolean) => void;
  avalancheNetworkID: number;
  isRegistering: boolean;
}

export default function CreateNodeForm({
  onClose,
  onSubmit,
  onError,
  avalancheNetworkID,
  isRegistering,
}: CreateNodeFormProps) {
  const [subnetId, setSubnetId] = useState('');
  const [subnet, setSubnet] = useState<any>(null);
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
  const [selectedBlockchainId, setSelectedBlockchainId] = useState<string>('');

  useEffect(() => {
    setSubnetIdError(null);
    setSubnet(null);
    setBlockchainInfo(null);
    setSelectedBlockchainId('');
    if (!subnetId) return;

    const abortController = new AbortController();
    setIsLoading(true);

    const loadSubnetData = async () => {
      try {
        const subnetInfo = await getSubnetInfo(subnetId, abortController.signal);
        if (abortController.signal.aborted) return;

        setSubnet(subnetInfo);

        if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
          const blockchainId = subnetInfo.blockchains[0].blockchainId;
          setSelectedBlockchainId(blockchainId);

          try {
            const chainInfo = await getBlockchainInfo(blockchainId, abortController.signal);
            if (abortController.signal.aborted) return;
            setBlockchainInfo(chainInfo);
          } catch (error) {
            if (!abortController.signal.aborted) {
              setSubnetIdError((error as Error).message);
            }
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setSubnetIdError((error as Error).message);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadSubnetData();
    return () => abortController.abort();
  }, [subnetId]);

  const handleCreateNode = () => {
    if (!subnetId) {
      onError('Missing Information', 'Please enter a subnet ID first');
      return;
    }
    if (!selectedBlockchainId) {
      onError('Missing Information', 'No blockchain found for this subnet');
      return;
    }
    onSubmit(subnetId, selectedBlockchainId);
  };

  return (
    <Board className="not-prose border-x border-t">
      <BoardHeader
        label="Add a node"
        display
        action={
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        }
      />
      <div className="flex flex-col gap-4 px-5 py-5 md:px-6">
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Enter the Subnet ID of the L1 you want a node for.
        </p>

        <InputSubnetId value={subnetId} onChange={setSubnetId} error={subnetIdError} />

        {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
          <div className="flex flex-col gap-4">
            {subnet.blockchains.map(
              (blockchain: {
                blockchainId: string;
                blockchainName: string;
                createBlockTimestamp: number;
                createBlockNumber: string;
                vmId: string;
                subnetId: string;
                evmChainId: number;
              }) => (
                <BlockchainDetailsDisplay
                  key={blockchain.blockchainId}
                  blockchain={{
                    ...blockchain,
                    isTestnet: avalancheNetworkID === networkIDs.FujiID,
                  }}
                  isLoading={isLoading}
                  customTitle={`${blockchain.blockchainName} Blockchain Details`}
                />
              ),
            )}
          </div>
        )}

        {subnetId && blockchainInfo && (
          <div>
            <button type="button" onClick={handleCreateNode} disabled={isRegistering} className={PRIMARY_BTN}>
              {isRegistering && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create node
              <HoverArrow />
            </button>
          </div>
        )}
      </div>
    </Board>
  );
}
