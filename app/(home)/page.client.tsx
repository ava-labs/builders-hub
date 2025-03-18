'use client';
import { TerminalIcon } from 'lucide-react';
import React, {
  useEffect,
  useState,
  Fragment,
  type ReactElement,
} from 'react';


export function DeployBlockchainAnimation(): React.ReactElement {
  const installCmd = 'avalanche blockchain deploy myblockchain';
  const tickTime = 50;
  const timeCommandEnter = installCmd.length;
  const timeCommandRun = timeCommandEnter + 3;
  const timeCommandEnd = timeCommandRun + 3;
  const timeWindowOpen = timeCommandEnd + 1;
  const timeEnd = timeWindowOpen + 1;

  const [tick, setTick] = useState(timeEnd);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => (prev >= timeEnd ? prev : prev + 1));
    }, tickTime);

    return () => {
      clearInterval(timer);
    };
  }, [timeEnd]);

  const lines: ReactElement[] = [];

  lines.push(
    <span key="command_type text-xl">
      {installCmd.substring(0, tick)}
      {tick < timeCommandEnter && (
        <div className="inline-block h-3 w-1 animate-pulse bg-white" />
      )}
    </span>,
  );

  if (tick >= timeCommandEnter) {
    lines.push(<span key="space"> </span>);
  }

  if (tick > timeCommandRun)
    lines.push(
      <Fragment key="command_response">
        <span className="font-bold">
          <span className="text-purple-500">?</span> Choose a network for the operation:
        </span>
        {tick > timeCommandRun + 1 && (
          <>
            <span>▸ <u>Local Network</u></span>
            <span>  Devnet</span>
            <span>  Fuji Testnet</span>
            <span>  Mainnet</span>
          </>
        )}
        {tick > timeCommandRun + 2 && (
          <>
            <br/>
            <span>Deploying <i className="font-bold">[myblockchain]</i> to Local Network...</span>
          </>
        )}
        {tick > timeCommandRun + 3 && (
          <>
            <br/>
            <span className="font-bold">Blockchain ready to use</span>
          </>
        )}
      </Fragment>,
    );

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        if (tick >= timeEnd) {
          setTick(0);
        }
      }}
    >
      <pre className="overflow-hidden rounded-xl border text-xs">
        <div className="flex flex-row items-center gap-2 border-b px-4 py-2">
          <TerminalIcon className="size-4" />{' '}
          <span className="font-bold">Avalanche CLI</span>
          <div className="grow" />
          <div className="size-2 rounded-full bg-green-400" />
        </div>
        <div className="min-h-[200px] bg-linear-to-b from-fd-secondary [mask-image:linear-gradient(to_bottom,white)]">
          <code className="grid p-4">{lines}</code>
        </div>
      </pre>
    </div>
  );
}