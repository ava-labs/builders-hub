"use client";

import { ExternalLink } from "lucide-react";
import type { FlowEntry } from "./types";
import { formatAvax, formatGas, shortAddr, snowtraceUrl } from "./utils";

export function FlowTable({ title, entries, color }: { title: string; entries: FlowEntry[]; color: string }) {
  if (entries.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{title}</h4>
        <p className="text-xs text-zinc-400">No data</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left py-1.5 pr-2 font-medium text-zinc-500">Address</th>
              <th className="text-right py-1.5 px-2 font-medium text-zinc-500">AVAX</th>
              <th className="text-right py-1.5 px-2 font-medium text-zinc-500">%</th>
              <th className="text-right py-1.5 pl-2 font-medium text-zinc-500">Txs</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.address} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                    <div className="flex flex-col">
                      {entry.name && (
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{entry.name}</span>
                      )}
                      {entry.address !== "others" ? (
                        <a
                          href={snowtraceUrl(entry.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-blue-500 transition-colors inline-flex items-center gap-0.5"
                        >
                          {shortAddr(entry.address)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-zinc-400">{entry.name}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-right py-1.5 px-2 font-mono text-zinc-600 dark:text-zinc-400">{formatAvax(entry.avax)}</td>
                <td className="text-right py-1.5 px-2 font-mono text-zinc-500">{entry.gasPercent.toFixed(1)}%</td>
                <td className="text-right py-1.5 pl-2 font-mono text-zinc-500">{formatGas(entry.txCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
