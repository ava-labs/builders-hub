import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, BoardHeader, CellLabel, HashChip, SectionHeader, SpecPlate, SpecRow, SubjectHeadline } from "@/components/explorer-v2/ui";
import { formatNumber, formatTime, timeAgo } from "@/components/explorer-v2/format";
import { ICM_STATUS_LABEL, TELEPORTER_ADDRESS, icmTxHref, resolveIcmChain, type IcmChain, type IcmMessage as IcmMessageData, type IcmStatus } from "@/lib/icm-message";

/* Delivery outcome, encoded in form as well as words: a message that reverted on
   arrival must not read like one that landed. */
const STATUS_TONE: Record<IcmStatus, string> = {
  executed:
    "border-[#4e9a52]/40 bg-[#4e9a52]/10 text-[#3f7d43] dark:border-[#4e9a52]/45 dark:text-[#77c47b]",
  delivered:
    "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
  executionFailed:
    "border-[#E6212F]/40 bg-[#E6212F]/10 text-[#c11824] dark:border-[#E6212F]/50 dark:text-[#ff6b73]",
  sent: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/45 dark:text-amber-400",
};

export function IcmStatusPill({ status }: { status: IcmStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        STATUS_TONE[status],
      )}
    >
      <span
        className={cn("size-1 shrink-0 bg-current opacity-80", status === "sent" && "animate-pulse")}
        aria-hidden
      />
      {ICM_STATUS_LABEL[status]}
    </span>
  );
}

function ChainLogo({ chain, size }: { chain: IcmChain | null; size: "sm" | "md" }) {
  const box = size === "md" ? "h-5 w-5" : "h-4 w-4";
  if (chain?.logoURI) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={chain.logoURI} alt="" className={`${box} shrink-0 rounded-full object-contain`} />;
  }
  return (
    <span
      className={`${box} shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800`}
      aria-hidden
    />
  );
}

function Endpoint({
  role,
  chain,
  txHash,
  txMissingNote,
}: {
  role: string;
  chain: IcmChain | null;
  txHash?: string;
  txMissingNote: string;
}) {
  const href = icmTxHref(chain, txHash);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
        {role}
      </p>
      <span className="flex min-w-0 items-center gap-2.5">
        <ChainLogo chain={chain} size="md" />
        {chain ? (
          chain.href ? (
            <Link
              href={chain.href}
              className="min-w-0 truncate text-[15px] font-semibold text-zinc-900 underline-offset-4 hover:text-[#E6212F] hover:underline dark:text-zinc-50"
            >
              {chain.name}
            </Link>
          ) : (
            <span className="min-w-0 truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
              {chain.name}
            </span>
          )
        ) : (
          <span className="text-[15px] font-semibold text-zinc-400 dark:text-zinc-500">Unknown</span>
        )}
      </span>
      {txHash ? (
        <HashChip value={txHash} href={href} len={18} />
      ) : (
        <p className="text-[12px] leading-relaxed text-zinc-400 dark:text-zinc-500">{txMissingNote}</p>
      )}
    </div>
  );
}

/* The page body for a hash that is not an ICM message on any chain we index. */
function NoMessage({ messageId }: { messageId: string }) {
  return (
    <Board divide={false} className="px-5 py-10 md:px-6 md:py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
        No interchain message
      </p>
      <p className="mt-3 break-all font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{messageId}</p>
      <p className="mt-5 max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        No Teleporter events carry this message ID on any chain we index. It may belong to a chain
        outside our indexing set, or it may not be a message ID at all.
      </p>
    </Board>
  );
}

export function IcmMessageView({
  messageId,
  message,
}: {
  messageId: string;
  message: IcmMessageData | null;
}) {
  if (!message) return <NoMessage messageId={messageId} />;

  const source = resolveIcmChain(message.sourceEvmChainId, message.sourceBlockchainId);
  const destination = resolveIcmChain(
    message.destinationEvmChainId ?? message.deliveredOnEvmChainId,
    message.destinationBlockchainId,
  );
  const deliveredOn = resolveIcmChain(message.deliveredOnEvmChainId);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHeader label="Interchain Message" action={<IcmStatusPill status={message.status} />} />
        <SubjectHeadline value={message.messageId} copyLabel="Copy message ID" />

        <Board divide={false}>
          <BoardHeader label="Route" />
          <div className="grid items-start gap-6 px-5 py-5 md:grid-cols-[1fr_auto_1fr] md:gap-8 md:px-6">
            <Endpoint
              role="Source"
              chain={source}
              txHash={message.sendTxHash}
              txMissingNote="Send transaction not indexed here."
            />
            <ArrowRight
              className="hidden h-4 w-4 self-center text-zinc-300 md:block dark:text-zinc-600"
              aria-hidden
            />
            <Endpoint
              role="Destination"
              chain={destination}
              txHash={message.deliveryTxHash}
              txMissingNote={
                message.destinationIndexed === false
                  ? "Destination is outside our indexing set, so a delivery here would be invisible to us."
                  : "No delivery seen yet."
              }
            />
          </div>
        </Board>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader label="Details" />
        <Board divide={false} className="px-5 py-4 md:px-6">
          <SpecPlate>
            <SpecRow label="Status">{ICM_STATUS_LABEL[message.status]}</SpecRow>
            {message.status === "executionFailed" && (
              <SpecRow label="Outcome" align="start">
                <span className="block max-w-prose text-right text-[13px] font-normal leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Delivered, but the receiving contract reverted. The message can be retried on the
                  destination chain.
                </span>
              </SpecRow>
            )}
            {message.status === "sent" && message.destinationIndexed === false && (
              <SpecRow label="Note" align="start">
                <span className="block max-w-prose text-right text-[13px] font-normal leading-relaxed text-zinc-500 dark:text-zinc-400">
                  We do not index the destination chain, so this is not evidence the message is
                  stuck — only that we cannot see the other side.
                </span>
              </SpecRow>
            )}
            {deliveredOn && <SpecRow label="Delivered On">{deliveredOn.name}</SpecRow>}
            {message.deliverer && (
              <SpecRow label="Relayer">
                <HashChip
                  value={message.deliverer}
                  href={
                    deliveredOn?.href ? `${deliveredOn.href}/address/${message.deliverer}` : undefined
                  }
                  len={42}
                />
              </SpecRow>
            )}
            {source?.blockchainId && (
              <SpecRow label="Source Blockchain ID">
                <HashChip value={source.blockchainId} len={20} />
              </SpecRow>
            )}
            {destination?.blockchainId && (
              <SpecRow label="Destination Blockchain ID">
                <HashChip value={destination.blockchainId} len={20} />
              </SpecRow>
            )}
            <SpecRow label="Messenger">
              <HashChip value={TELEPORTER_ADDRESS} len={42} />
            </SpecRow>
          </SpecPlate>
        </Board>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader label={`Lifecycle · ${message.events.length}`} />
        <Board>
          <div className="hidden grid-cols-[1.1fr_1fr_1.2fr_0.8fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
            <span>Event</span>
            <span>Chain</span>
            <span>Transaction</span>
            <span className="text-right">Block</span>
          </div>
          {message.events.map((e) => {
            const chain = resolveIcmChain(e.evmChainId);
            return (
              <div
                key={`${e.evmChainId}-${e.txHash}-${e.logIndex}`}
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3.5 md:grid-cols-[1.1fr_1fr_1.2fr_0.8fr] md:items-center md:px-6"
              >
                <span className="min-w-0">
                  <CellLabel>Event</CellLabel>
                  <span className="block truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                    {e.event}
                  </span>
                  <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">
                    {formatTime(e.timestamp)} · {timeAgo(e.timestamp)}
                  </span>
                </span>
                <span className="min-w-0">
                  <CellLabel>Chain</CellLabel>
                  <span className="flex min-w-0 items-center gap-2">
                    <ChainLogo chain={chain} size="sm" />
                    {chain?.href ? (
                      <Link
                        href={chain.href}
                        className="min-w-0 truncate text-[13px] text-zinc-700 underline-offset-4 hover:text-[#E6212F] hover:underline dark:text-zinc-300"
                      >
                        {chain.name}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate text-[13px] text-zinc-700 dark:text-zinc-300">
                        {chain?.name ?? "—"}
                      </span>
                    )}
                  </span>
                </span>
                <span className="min-w-0">
                  <CellLabel>Transaction</CellLabel>
                  <HashChip value={e.txHash} href={icmTxHref(chain, e.txHash)} len={16} />
                </span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                  <CellLabel>Block</CellLabel>
                  {chain?.href ? (
                    <Link
                      href={`${chain.href}/block/${e.blockNumber}`}
                      className="underline-offset-4 hover:text-[#E6212F] hover:underline"
                    >
                      {formatNumber(e.blockNumber)}
                    </Link>
                  ) : (
                    formatNumber(e.blockNumber)
                  )}
                </span>
              </div>
            );
          })}
        </Board>
      </section>
    </div>
  );
}
