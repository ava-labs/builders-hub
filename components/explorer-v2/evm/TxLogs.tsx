"use client";

import { Fragment } from "react";
import { Board, HashChip, SectionHeader } from "@/components/explorer-v2/ui";
import { truncate } from "@/components/explorer-v2/format";
import { precompileValue } from "./format";
import { decodeEventWithAbi } from "@/lib/sourcify-client";
import { knownAddress, type EventLog } from "@/lib/evm-explorer";

/* The receipt's logs, flat, for a chain the explorer does not trace. A
   precompile's log decodes against the precompile's ABI: the event's
   name and its arguments, in the units the precompile means. Every log
   keeps its raw topics and data beneath. */

interface Arg {
  name: string;
  type: string;
  value: string;
  components?: Arg[];
}

/** one decoded value: an address with its name, a number in its unit,
 *  bytes with their size, or the value as it is */
function ArgValue({ arg, base, chainId, symbol }: { arg: Arg; base: string; chainId: string; symbol: string }) {
  const { name, type, value } = arg;
  if (type === "address") {
    // the decoder checksums; the explorer writes addresses in lower case
    const a = value.toLowerCase();
    const known = knownAddress(a, chainId);
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        {known && <span className="text-zinc-900 dark:text-zinc-50">{known.label}</span>}
        <HashChip value={a} href={`${base}/address/${a}`} len={42} />
      </span>
    );
  }
  if (type.startsWith("bytes")) {
    const size = (value.length - 2) / 2;
    return (
      <span className="break-all">
        {truncate(value, 66)}
        {value.length > 72 && <span className="text-zinc-400 dark:text-zinc-500"> · {size} bytes</span>}
      </span>
    );
  }
  return <span className="break-all">{/^\d+$/.test(value) ? precompileValue(name, value, symbol) : value}</span>;
}

/** a decoded precompile call's or log's arguments, one to a row; a
 *  tuple's fields nest under its name */
export function PrecompileArgs({ params, base, chainId, symbol }: { params: Arg[]; base: string; chainId: string; symbol: string }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 font-mono text-[12px] font-normal">
      {params.map((p) => (
        <Fragment key={p.name}>
          <dt className="text-zinc-400 dark:text-zinc-500">{p.name}</dt>
          <dd className="min-w-0 tabular-nums text-zinc-700 dark:text-zinc-300">
            {p.components ? <PrecompileArgs params={p.components} base={base} chainId={chainId} symbol={symbol} /> : <ArgValue arg={p} base={base} chainId={chainId} symbol={symbol} />}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function TxLogs({ logs, base, chainId, symbol }: { logs: EventLog[]; base: string; chainId: string; symbol: string }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label={`Event Logs · ${logs.length}`} />
      <Board>
        {logs.length === 0 && (
          <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
            no logs emitted
          </div>
        )}
        {logs.map((log) => {
          const known = knownAddress(log.address, chainId);
          const ev = decodeEventWithAbi(known?.abi, log);
          return (
            <div key={log.logIndex} className="flex flex-col gap-2 px-5 py-4 md:px-6">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3">
                  {known && <span className="font-mono text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{known.label}</span>}
                  <HashChip value={log.address} href={`${base}/address/${log.address}`} len={42} />
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  #{log.logIndex}
                </span>
              </div>
              {ev && (
                <div className="flex flex-col gap-1.5 pb-1">
                  <span className="font-mono text-[12.5px] text-violet-700 dark:text-violet-300">{ev.name}</span>
                  <PrecompileArgs params={ev.params} base={base} chainId={chainId} symbol={symbol} />
                </div>
              )}
              {log.topics.map((topic, ti) => (
                <p key={ti} className="break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="text-zinc-400 dark:text-zinc-600">[{ti}] </span>
                  {topic}
                </p>
              ))}
              {log.data && log.data !== "0x" && (
                <p className="break-all font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  {truncate(log.data, 80)}
                </p>
              )}
            </div>
          );
        })}
      </Board>
    </section>
  );
}
