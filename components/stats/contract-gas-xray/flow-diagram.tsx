"use client";

import { useState, useEffect, useRef } from "react";
import type { ContractGasFlowResponse, FlowEntry } from "./types";
import { formatAvax, shortAddr } from "./utils";

export function FlowDiagram({ data }: { data: ContractGasFlowResponse }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { callers, callees, summary, target } = data;
  const isMobile = width < 500;

  const height = isMobile ? 320 : Math.max(280, Math.max(callers.length, callees.length) * 32 + 60);
  const pad = { x: isMobile ? 10 : 16, y: 24 };
  const nodeW = isMobile ? 8 : 12;
  const centerW = isMobile ? 80 : 120;
  const innerW = width - pad.x * 2;
  const centerX = innerW / 2;

  const leftX = pad.x;
  const rightX = innerW - pad.x - nodeW;
  const centerLeft = centerX - centerW / 2;
  const centerRight = centerX + centerW / 2;

  function layoutNodes(entries: FlowEntry[], totalGas: number) {
    const gap = 3;
    const usable = height - pad.y * 2 - (entries.length - 1) * gap;
    let y = pad.y;
    return entries.map((e) => {
      const ratio = totalGas > 0 ? e.gas / totalGas : 1 / entries.length;
      const h = Math.max(6, ratio * usable);
      const pos = { y, h, mid: y + h / 2 };
      y += h + gap;
      return pos;
    });
  }

  const callerPositions = layoutNodes(callers, summary.totalGasReceived);
  const calleePositions = layoutNodes(callees, summary.totalGasGiven);

  const centerTop = pad.y;
  const centerBottom = height - pad.y;
  const centerH = centerBottom - centerTop;

  function bezier(x1: number, y1: number, x2: number, y2: number): string {
    const cx = (x1 + x2) / 2;
    return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
  }

  function strokeW(gas: number, total: number): number {
    if (total === 0) return 1;
    return Math.max(1, Math.min(8, (gas / total) * 20));
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <svg width={width} height={height} className="overflow-hidden">
        <defs>
          <linearGradient id="callerGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="calleeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {callers.map((entry, i) => {
          const pos = callerPositions[i];
          const sw = strokeW(entry.gas, summary.totalGasReceived);
          return (
            <path
              key={`c-${i}`}
              d={bezier(leftX + nodeW, pos.mid, centerLeft, centerTop + (pos.mid - pad.y) / (height - pad.y * 2) * centerH)}
              fill="none" stroke="url(#callerGrad)" strokeWidth={sw} opacity={0.7}
            />
          );
        })}

        {callees.map((entry, i) => {
          const pos = calleePositions[i];
          const sw = strokeW(entry.gas, summary.totalGasGiven);
          return (
            <path
              key={`e-${i}`}
              d={bezier(centerRight, centerTop + (pos.mid - pad.y) / (height - pad.y * 2) * centerH, rightX, pos.mid)}
              fill="none" stroke="url(#calleeGrad)" strokeWidth={sw} opacity={0.7}
            />
          );
        })}

        {callers.map((entry, i) => {
          const pos = callerPositions[i];
          return (
            <g key={`cn-${i}`}>
              <rect x={leftX} y={pos.y} width={nodeW} height={pos.h} rx={2} fill="#3b82f6" opacity={0.8} />
              {!isMobile && (
                <text x={leftX + nodeW + 6} y={pos.mid + 4} fontSize={10} fill="currentColor" className="text-zinc-500 dark:text-zinc-400">
                  {entry.name || shortAddr(entry.address)}
                </text>
              )}
            </g>
          );
        })}

        <rect x={centerLeft} y={centerTop} width={centerW} height={centerH} rx={6} className="fill-zinc-200 dark:fill-zinc-700" opacity={0.5} />
        <text x={centerX} y={centerTop + centerH / 2 - 6} textAnchor="middle" fontSize={isMobile ? 10 : 12} fontWeight="bold" fill="currentColor" className="text-zinc-700 dark:text-zinc-200">
          {target.name || shortAddr(target.address)}
        </text>
        <text x={centerX} y={centerTop + centerH / 2 + 12} textAnchor="middle" fontSize={isMobile ? 9 : 10} fill="currentColor" className="text-zinc-400 dark:text-zinc-500">
          Self: {formatAvax(summary.selfAvax)} AVAX ({(data.selfGasRatio * 100).toFixed(1)}%)
        </text>

        {callees.map((entry, i) => {
          const pos = calleePositions[i];
          return (
            <g key={`en-${i}`}>
              <rect x={rightX} y={pos.y} width={nodeW} height={pos.h} rx={2} fill="#f59e0b" opacity={0.8} />
              {!isMobile && (
                <text x={rightX - 6} y={pos.mid + 4} fontSize={10} textAnchor="end" fill="currentColor" className="text-zinc-500 dark:text-zinc-400">
                  {entry.name || shortAddr(entry.address)}
                </text>
              )}
            </g>
          );
        })}

        <text x={leftX + nodeW / 2} y={14} textAnchor="middle" fontSize={10} fontWeight="600" fill="currentColor" className="text-zinc-400">Callers</text>
        <text x={rightX + nodeW / 2} y={14} textAnchor="middle" fontSize={10} fontWeight="600" fill="currentColor" className="text-zinc-400">Callees</text>
      </svg>
    </div>
  );
}
