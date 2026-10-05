/**
 * The inbox bucket rule, shared by the client inbox (tabs, card pills) and the
 * server portal layout (the awaiting count on the Inbox tab). One definition,
 * so the badge and the "Awaiting your quote" tab can never disagree.
 */
export type InboxBucket = "awaiting" | "quoted" | "won" | "closed";

export interface InboxBucketInput {
  window_open: boolean;
  own_quote: { status: string } | null;
}

export function bucketOf(item: InboxBucketInput): InboxBucket {
  if (item.own_quote?.status === "accepted") return "won";
  if (item.own_quote && item.own_quote.status === "submitted" && item.window_open) return "quoted";
  if (item.window_open && !item.own_quote) return "awaiting";
  if (item.own_quote?.status === "submitted") return "quoted";
  return "closed";
}

/** Requests still waiting on this firm's quote: window open, nothing submitted. */
export function countAwaiting(items: InboxBucketInput[]): number {
  return items.filter((item) => bucketOf(item) === "awaiting").length;
}
