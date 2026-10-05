"use client";

import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, HashChip } from "@/components/explorer-v2/ui";
import { truncate } from "@/components/explorer-v2/format";
import { formatEther, precompileValue } from "./format";
import { useVerifiedContracts } from "@/lib/sourcify-client";
import { knownAddress } from "@/lib/evm-explorer";
import { formatTokenAmount, useTokenPrices, usdOfToken, type TokenMap } from "@/lib/token-list";
import { usdOfWei } from "./hooks";
import { NativeMark, TokenLogo, TokenMark } from "./TokenMark";
import { VERB_WORDS, type Flow, type Story } from "@/lib/tx-story";
import { FEE_FIELDS, type PrecompileAct } from "@/lib/precompiles";

/* The glance layer of a transaction: one sentence saying what the sender
   did, in the words a person would use, then the sender's own ledger of
   what left and what arrived, priced. It sits above the readings and the
   execution trace and asks nothing of the reader; the trace below is for
   whoever wants to know how. The sentence names only what the receipt
   proves: verbs come from the events that fired and the assets that
   moved, and an unfamiliar shape says "called". */

const INK = "text-zinc-900 dark:text-zinc-50";

function Name({ addr, base, chainId, tokens, names }: { addr: string; base: string; chainId: string; tokens: TokenMap; names: Map<string, { name: string | null }> }) {
  const a = addr.toLowerCase();
  const tok = tokens.get(a);
  const label = names.get(a)?.name ?? knownAddress(a, chainId)?.label;
  return (
    <Link href={`${base}/address/${addr}`} className={cn("inline-flex items-center gap-1.5 align-baseline hover:text-[#E6212F]", INK)} title={addr}>
      {tok ? <TokenMark address={addr} chainId={chainId} token={tok} size={18} /> : label ? <span className="font-medium">{label}</span> : <span className="font-medium">{truncate(addr, 12)}</span>}
    </Link>
  );
}

function Amount({ flow, chainId, symbol, tokens, usd }: { flow: Flow; chainId: string; symbol: string; tokens: TokenMap; usd?: string }) {
  const abs = flow.amount < 0n ? -flow.amount : flow.amount;
  const tok = flow.token ? tokens.get(flow.token) : undefined;
  return (
    <span className={cn("inline-flex items-center gap-1.5 align-baseline font-medium tabular-nums", INK)}>
      {flow.token === null ? formatEther(abs.toString(), { decimals: 6 }) : tok ? formatTokenAmount(abs, tok.decimals) : abs.toString()}
      {flow.token === null ? <NativeMark symbol={symbol} size={18} /> : tok ? <TokenMark address={flow.token} chainId={chainId} token={tok} size={18} /> : <HashChip value={flow.token} len={10} />}
      {usd && <span className="font-normal text-zinc-400 dark:text-zinc-500">({usd})</span>}
    </span>
  );
}

type Words = (a: string) => React.ReactNode;

/** an allow-list role by its number: the words that give it, and the
 *  words for having had it */
const ROLE_WORDS: { give: (who: React.ReactNode, on: React.ReactNode) => React.ReactNode; had: string }[] = [
  { give: (who, on) => <>removed {who} from {on}</>, had: "had no role" },
  { give: (who, on) => <>enabled {who} on {on}</>, had: "was enabled" },
  { give: (who, on) => <>made {who} an admin of {on}</>, had: "was an admin" },
  { give: (who, on) => <>made {who} a manager of {on}</>, had: "was a manager" },
];

/** one precompile change in the words after the sentence's subject; a
 *  mint is the verb's own words, so it never comes here */
function actWords(act: PrecompileAct, nm: Words, direct: boolean): React.ReactNode {
  switch (act.kind) {
    case "role": {
      const had = act.was !== null && act.was !== act.role ? ROLE_WORDS[act.was]?.had : null;
      return (
        <>
          {ROLE_WORDS[act.role]?.give(nm(act.account), nm(act.at)) ?? <>gave {nm(act.account)} role {act.role} on {nm(act.at)}</>}
          {had && <> ({had})</>}
        </>
      );
    }
    case "fees":
      if (act.fields.some((f) => f.was === null)) return <>set the fee config on {nm(act.at)}</>;
      return act.fields.some((f) => f.was !== f.now) ? <>changed the fee config on {nm(act.at)}</> : <>set the fee config on {nm(act.at)}, with no change</>;
    case "rewardAddress":
      return <>set the reward address on {nm(act.at)} to {nm(act.to)}</>;
    case "feeRecipients":
      return <>let block producers collect the fees on {nm(act.at)}</>;
    case "burnFees":
      return <>disabled rewards on {nm(act.at)}, so the chain burns the fees</>;
    case "warp":
      return <>sent a Warp message{direct && <> via {nm(act.at)}</>}</>;
    case "mint":
      return null;
  }
}

export function EvmTxStory({
  story,
  actor,
  chainId,
  base,
  symbol,
  tokens,
  usd,
  counts,
}: {
  story: Story;
  actor: string;
  chainId: string;
  base: string;
  symbol: string;
  tokens: TokenMap;
  /** the native coin's USD price */
  usd: number | null;
  /** what the deeper layers hold, for the line that doors into them */
  counts: { transfers: number; events: number; calls: number | null };
}) {
  const actParties = story.acts.flatMap((a) => [a.at, "to" in a ? a.to : null, "account" in a ? a.account : null]);
  const parties = [story.counterparty, ...story.movements.map((m) => m.token), ...actParties].filter((a): a is string => !!a);
  const names = useVerifiedContracts(chainId, parties);
  const flows = [...story.outs, ...story.ins];
  const prices = useTokenPrices(chainId, flows.map((f) => f.token).filter((t): t is string => !!t));
  const w = VERB_WORDS[story.verb];
  const usdOf = (f: Flow) => {
    const abs = f.amount < 0n ? -f.amount : f.amount;
    if (f.token === null) return usdOfWei(abs, usd);
    const tok = tokens.get(f.token);
    return tok ? usdOfToken(abs, tok.decimals, prices.get(f.token)) : undefined;
  };
  const nm = (a: string) => <Name addr={a} base={base} chainId={chainId} tokens={tokens} names={names} />;
  const amt = (f: Flow) => <Amount flow={f} chainId={chainId} symbol={symbol} tokens={tokens} usd={usdOf(f)} />;

  // the sentence: subject, verb, object, counterparty, in that order,
  // with the pieces the story has
  const sentence = (() => {
    const subject = nm(actor);
    const cp = story.counterparty ? nm(story.counterparty) : null;
    const method = story.methodName ? <span className="font-mono text-[0.9em] text-violet-700 dark:text-violet-300">{story.methodName}</span> : null;
    switch (story.verb) {
      case "swap":
        return (
          <>
            {subject} swapped {story.primary && amt(story.primary)} for {story.secondary ? amt(story.secondary) : "nothing back"}
            {cp && <> on {cp}</>}
          </>
        );
      case "wrap":
      case "unwrap":
        return (
          <>
            {subject} {w.past} {story.primary && amt(story.primary)} into {story.secondary && amt(story.secondary)}
          </>
        );
      case "approve":
        return (
          <>
            {subject} approved {cp} to spend its tokens
          </>
        );
      case "call":
        return (
          <>
            {subject} called {method ?? "a function"}
            {cp && <> on {cp}</>}
          </>
        );
      case "deploy":
        return (
          <>
            {subject} deployed a contract{cp && <> at {cp}</>}
          </>
        );
      case "revert":
        return (
          <>
            {subject} called {method ?? "a function"}
            {cp && <> on {cp}</>}, and it reverted
            {story.revertReason && <>: {story.revertReason}</>}
          </>
        );
      case "liquidate":
        return (
          <>
            {subject} liquidated a position{cp && <> on {cp}</>}
          </>
        );
      // a precompile's change: the sender's own words when it called the
      // precompile itself, else the call that led there
      case "mint":
      case "configure":
      case "message": {
        const more = story.acts.length - 1;
        const recipients = [...new Set(story.acts.flatMap((a) => (a.kind === "mint" ? [a.to] : [])))];
        const did =
          story.verb === "mint" ? (
            <>
              minted {story.primary && amt(story.primary)} to {recipients.length === 1 ? nm(recipients[0]) : `${recipients.length} accounts`}
            </>
          ) : (
            <>
              {story.acts[0] && actWords(story.acts[0], nm, story.direct)}
              {more > 0 && <>, and {more} more change{more === 1 ? "" : "s"}</>}
            </>
          );
        return story.direct ? (
          <>
            {subject} {did}
          </>
        ) : (
          <>
            {subject} called {method ?? "a function"}
            {cp && <> on {cp}</>}, which {did}
          </>
        );
      }
      default:
        return (
          <>
            {subject} {w.past} {story.primary && amt(story.primary)}
            {cp && (
              <>
                {" "}
                {w.join} {cp}
              </>
            )}
          </>
        );
    }
  })();

  // the sender's ledger: every asset that left or arrived, priced
  const ledger = flows.length > 0;
  const showMovements = flows.length === 0 && story.movements.length > 0;
  // a new fee config: each field it set, after what it was when the log says
  const fees = story.verb === "configure" ? story.acts.find((a): a is Extract<PrecompileAct, { kind: "fees" }> => a.kind === "fees") : undefined;
  const feeRows = fees ? fees.fields.filter((f) => f.was === null || f.was !== f.now) : [];

  return (
    <Board divide={false}>
      <p className={cn("px-5 py-7 font-mono text-[15px] leading-[1.9] md:px-6 md:py-8 md:text-[17px]", "text-zinc-600 dark:text-zinc-400")}>{sentence}</p>

      {feeRows.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          {feeRows.map((f) => (
            <div key={f.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-2.5 font-mono text-[12.5px] md:h-11 md:px-6">
              <span className="truncate text-zinc-500 dark:text-zinc-400">{FEE_FIELDS.find((x) => x.name === f.name)?.label ?? f.name}</span>
              <span className="flex items-baseline gap-2 tabular-nums">
                {f.was !== null && (
                  <>
                    <span className="text-zinc-400 dark:text-zinc-500">{precompileValue(f.name, f.was, symbol)}</span>
                    <span className="text-zinc-300 dark:text-zinc-700">→</span>
                  </>
                )}
                <span className={INK}>{precompileValue(f.name, f.now, symbol)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* the sender's ledger: what left, what arrived */}
      {ledger && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          {flows.map((f) => {
            const neg = f.amount < 0n;
            const abs = neg ? -f.amount : f.amount;
            const tok = f.token ? tokens.get(f.token) : undefined;
            const price = usdOf(f);
            return (
              <div key={f.token ?? "native"} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-2.5 font-mono text-[12.5px] md:h-11 md:px-6">
                <span className={cn("text-center tabular-nums", neg ? "text-[#E6212F]" : "text-emerald-600 dark:text-emerald-400")}>{neg ? "−" : "+"}</span>
                <span className="flex min-w-0 items-center gap-2">
                  {f.token === null ? (
                    <>
                      <NativeMark symbol={symbol} size={16} />
                      <span className={cn("font-medium", INK)}>{symbol}</span>
                    </>
                  ) : tok ? (
                    <>
                      <TokenLogo address={f.token} chainId={chainId} token={tok} size={16} />
                      <Link href={`${base}/address/${f.token}`} className="min-w-0 truncate hover:text-[#E6212F]">
                        <span className={cn("font-medium", INK)}>{tok.symbol}</span>
                        {tok.name !== tok.symbol && <span className="ml-2 text-zinc-400 dark:text-zinc-500">{tok.name}</span>}
                      </Link>
                    </>
                  ) : (
                    <HashChip value={f.token} href={`${base}/address/${f.token}`} len={12} />
                  )}
                </span>
                <span className="flex items-baseline gap-3 tabular-nums">
                  <span className={INK}>{f.token === null ? formatEther(abs.toString(), { decimals: 6 }) : tok ? formatTokenAmount(abs, tok.decimals) : abs.toString()}</span>
                  <span className="w-20 text-right text-zinc-400 dark:text-zinc-500">{price ?? ""}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* nothing landed on the sender: what moved among everyone else */}
      {showMovements && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          {story.movements.slice(0, 6).map((m) => {
            const tok = tokens.get(m.token);
            return (
              <div key={m.token} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-2.5 font-mono text-[12.5px] md:h-11 md:px-6">
                <span className="flex min-w-0 items-center gap-2">
                  {tok ? (
                    <>
                      <TokenLogo address={m.token} chainId={chainId} token={tok} size={16} />
                      <Link href={`${base}/address/${m.token}`} className="min-w-0 truncate hover:text-[#E6212F]">
                        <span className={cn("font-medium", INK)}>{tok.symbol}</span>
                        {tok.name !== tok.symbol && <span className="ml-2 text-zinc-400 dark:text-zinc-500">{tok.name}</span>}
                      </Link>
                    </>
                  ) : (
                    <HashChip value={m.token} href={`${base}/address/${m.token}`} len={12} />
                  )}
                </span>
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {m.count} transfer{m.count === 1 ? "" : "s"}
                  {tok && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700"> · </span>
                      <span className={INK}>{formatTokenAmount(m.total, tok.decimals)}</span> {tok.symbol}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* the door down */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-zinc-200 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
        <span>
          {counts.transfers} transfer{counts.transfers === 1 ? "" : "s"} · {counts.events} event{counts.events === 1 ? "" : "s"}
          {counts.calls !== null && <> · {counts.calls} call{counts.calls === 1 ? "" : "s"}</>}
          {story.bystanders > 0 && flows.length > 0 && <> · {story.bystanders} between other accounts</>}
        </span>
        {counts.calls !== null && (
          <a href="#execution" className="inline-flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            How it ran
            <ArrowDown className="size-3" />
          </a>
        )}
      </div>
    </Board>
  );
}
