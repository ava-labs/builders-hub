import type { Abi, Address, Log } from 'viem';
import { PublicClient } from 'viem';
import { decodeEventLog } from 'viem';
import { useState, useEffect } from 'react';

export function ListContractEvents({
  contractAddress,
  contractABI,
  publicClient,
  title = 'Contract Events',
  blockLimit = 2000, // Maximum number of blocks to query
}: {
  contractAddress: string;
  contractABI: Abi;
  publicClient: PublicClient;
  title?: string;
  blockLimit?: number;
}) {
  const [events, setEvents] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestBlock, setLatestBlock] = useState<bigint | null>(null);

  useEffect(() => {
    if (!contractAddress || !publicClient) return;

    const fetchEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the latest block
        const latest = await publicClient.getBlockNumber();
        setLatestBlock(latest);

        // Calculate the fromBlock (latest - blockLimit)
        // This ensures we only look at recent blocks within RPC provider limits
        const fromBlock = latest > BigInt(blockLimit) ? latest - BigInt(blockLimit) : BigInt(0);

        // Get logs for the contract
        const logs = await publicClient.getLogs({
          address: contractAddress as Address,
          fromBlock,
          toBlock: 'latest',
        });

        setEvents(logs);
      } catch (err: any) {
        console.error('Error fetching events:', err);
        setError(`Failed to fetch events: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [contractAddress, publicClient, blockLimit]);

  // Decode an event log
  const decodeEvent = (log: Log) => {
    try {
      const decodedEvent = decodeEventLog({
        abi: contractABI,
        data: log.data,
        topics: log.topics,
        strict: false, // Set to false to prevent errors if unknown events are present
      });

      return {
        name: decodedEvent.eventName,
        args: decodedEvent.args,
      };
    } catch (e) {
      console.error('Error decoding event:', e);
      return { name: 'Unknown Event', args: {} };
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <h3 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>

      {latestBlock && (
        <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
          Showing events from the last {blockLimit.toLocaleString()} blocks (current block: {latestBlock.toString()})
        </div>
      )}

      {loading && <div className="text-[13px] text-zinc-500 dark:text-zinc-400">Loading events...</div>}

      {error && (
        <div className="border border-red-200 bg-red-50/60 p-3 text-[13px] text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="border border-zinc-200 bg-zinc-50/60 p-3 text-[13px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          No events found in recent blocks. The contract may have no events or they occurred before the query range.
        </div>
      )}

      <div className="divide-y divide-zinc-200 border border-zinc-200 empty:border-0 dark:divide-zinc-800 dark:border-zinc-800">
        {events.map((log) => {
          let decodedEvent;
          try {
            decodedEvent = decodeEvent(log);
          } catch {
            decodedEvent = { name: 'Error Decoding', args: {} };
          }

          return (
            <div key={`${log.transactionHash}-${log.logIndex}`} className="bg-white p-4 dark:bg-zinc-950">
              <div className="flex flex-col md:flex-row justify-between">
                <div className="flex-grow">
                  <h4 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {decodedEvent.name || 'Unknown Event'}
                  </h4>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {Object.entries(decodedEvent.args || {}).map(([key, value]) => (
                      <div key={key} className="flex flex-col">
                        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                          {key}
                        </span>
                        <span className="break-all font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex flex-col items-start space-y-1 font-mono text-[11px] text-zinc-500 md:mt-0 md:items-end dark:text-zinc-400">
                  <div>
                    <span className="font-medium">Block: </span>
                    <span>{log.blockNumber?.toString() || 'Pending'}</span>
                  </div>

                  <div>
                    <span className="font-medium">TX: </span>
                    <button
                      className="font-mono text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                      onClick={() => navigator.clipboard.writeText(log.transactionHash || '')}
                      title="Click to copy transaction hash"
                    >
                      {log.transactionHash?.slice(0, 10)}...{log.transactionHash?.slice(-8)}
                    </button>
                  </div>

                  <div>
                    <span className="font-medium">Log Index: </span>
                    <span>{log.logIndex?.toString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
