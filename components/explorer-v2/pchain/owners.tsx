"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HashChip, idInk } from "@/components/explorer-v2/ui";
import { truncate } from "@/components/explorer-v2/format";

/** a UTXO's first owner, and every owner of a multisig in a card that opens on hover or tap */
export function Owners({
  owners,
  threshold,
  hrefOf,
  len = 10,
  className,
}: {
  owners: string[];
  threshold?: number;
  hrefOf: (a: string) => string;
  len?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closing.current), []);
  // a hover leaves the focus where it was; a tap or a key moves it into the card
  const byHover = useRef(false);
  // a mouse may cross the gap between the chip and the card without closing it; a touch opens it with a tap
  const hover = (on: boolean) => {
    clearTimeout(closing.current);
    if (on) setOpen(true);
    else closing.current = setTimeout(() => setOpen(false), 150);
  };
  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(owners.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  if (owners.length === 1) return <HashChip value={owners[0]} href={hrefOf(owners[0])} />;
  return (
    <span className={cn("flex min-w-0 items-center gap-2 whitespace-nowrap", className)}>
      <Link href={hrefOf(owners[0])} className={cn(idInk, "min-w-0 truncate hover:text-[#E6212F]")} title={owners[0]}>
        {truncate(owners[0], len)}
      </Link>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`All ${owners.length} owners`}
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              if (!open) byHover.current = true;
              hover(true);
            }}
            onPointerLeave={(e) => e.pointerType === "mouse" && hover(false)}
            // a click keeps a hover-opened card open instead of toggling it shut
            onClick={(e) => {
              e.preventDefault();
              if (!open) byHover.current = false;
              hover(true);
            }}
            className="shrink-0 border border-zinc-200 px-1.5 font-mono text-[11px] leading-[18px] text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 data-[state=open]:border-zinc-400 data-[state=open]:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100 dark:data-[state=open]:border-zinc-600 dark:data-[state=open]:text-zinc-100"
          >
            +{owners.length - 1}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={8}
          aria-label="Owners"
          onOpenAutoFocus={(e) => byHover.current && e.preventDefault()}
          onCloseAutoFocus={(e) => byHover.current && e.preventDefault()}
          onPointerEnter={(e) => e.pointerType === "mouse" && hover(true)}
          onPointerLeave={(e) => e.pointerType === "mouse" && hover(false)}
          className="w-auto max-w-[95vw] rounded-none border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-4 dark:border-zinc-800 dark:text-zinc-500">
            <p>{threshold ? `${threshold} of ${owners.length} to sign` : `${owners.length} owners`}</p>
            <button
              type="button"
              onClick={copyAll}
              className="-my-1 inline-flex items-center gap-1.5 py-1 uppercase transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {copied ? <Check className="h-3 w-3 text-[#E6212F]" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy all"}
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 px-3 py-3 md:px-4">
            {owners.map((a) => (
              <li key={a} className="flex max-md:[&_a]:text-[11px]">
                <HashChip value={a} href={hrefOf(a)} len={66} />
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
