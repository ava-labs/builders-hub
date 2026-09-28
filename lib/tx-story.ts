/* What a transaction did, in one sentence's worth of structure. Pure:
   takes the sender, the call target, the value, the token transfers the
   receipt logged, the native coin the sender netted, and the names of
   the events that fired; returns a verb, the sender's flows in and out,
   and who they dealt with. The page turns this into words. It never
   guesses beyond the evidence: an unknown shape is "called X on Y". */

export type Verb =
  | "swap"
  | "send"
  | "receive"
  | "repay"
  | "borrow"
  | "deposit"
  | "withdraw"
  | "claim"
  | "stake"
  | "unstake"
  | "bridge"
  | "liquidate"
  | "wrap"
  | "unwrap"
  | "approve"
  | "call"
  | "deploy"
  | "revert";

/** one asset's net movement from the sender's side: + in, − out */
export interface Flow {
  /** null = the chain's native coin */
  token: string | null;
  amount: bigint;
}

export interface StoryInput {
  actor: string;
  to: string | null | undefined;
  contractAddress?: string | null;
  success: boolean;
  /** the sender's net native movement, fee excluded: value sent, refunds and unwraps received */
  nativeNet: bigint;
  transfers: { token: string; from: string; to: string; amount: bigint }[];
  /** decoded event names, e.g. "Swap", "Repay", "Approval" */
  eventNames: string[];
  /** a token address the call target resolves to, when it is a listed token */
  targetIsToken: boolean;
  methodName: string | null;
  revertReason?: string | null;
}

export interface Story {
  verb: Verb;
  /** the sender's assets out and in, netted per token */
  outs: Flow[];
  ins: Flow[];
  /** the flow the sentence leads with, and the one it answers with (swaps) */
  primary: Flow | null;
  secondary: Flow | null;
  /** the account the sentence is about, besides the sender */
  counterparty: string | null;
  /** transfers the sender was not party to */
  bystanders: number;
  /** all transfers, netted per token, for the movements ledger */
  movements: { token: string; count: number; total: bigint }[];
  methodName: string | null;
  revertReason: string | null;
}

const ZERO = "0x0000000000000000000000000000000000000000";

export function storyOf(i: StoryInput): Story {
  const actor = i.actor.toLowerCase();
  const to = i.to?.toLowerCase() ?? null;

  // the sender's net position per token
  const net = new Map<string | null, bigint>();
  const add = (token: string | null, d: bigint) => net.set(token, (net.get(token) ?? 0n) + d);
  let bystanders = 0;
  const moves = new Map<string, { count: number; total: bigint }>();
  for (const x of i.transfers) {
    const from = x.from.toLowerCase();
    const dest = x.to.toLowerCase();
    if (from === actor) add(x.token.toLowerCase(), -x.amount);
    if (dest === actor) add(x.token.toLowerCase(), x.amount);
    if (from !== actor && dest !== actor) bystanders++;
    const m = moves.get(x.token.toLowerCase()) ?? { count: 0, total: 0n };
    m.count++;
    m.total += x.amount;
    moves.set(x.token.toLowerCase(), m);
  }
  if (i.nativeNet !== 0n) add(null, i.nativeNet);

  const outs: Flow[] = [];
  const ins: Flow[] = [];
  for (const [token, amount] of net) {
    if (amount < 0n) outs.push({ token, amount });
    else if (amount > 0n) ins.push({ token, amount });
  }
  // native first, then by address, so the sentence is stable across renders
  const order = (a: Flow, b: Flow) => (a.token === null ? -1 : b.token === null ? 1 : a.token.localeCompare(b.token));
  outs.sort(order);
  ins.sort(order);

  const names = i.eventNames.map((n) => n.toLowerCase());
  const has = (re: RegExp) => names.some((n) => re.test(n));
  const onlyTokenIs = (flows: Flow[], token: string | null) => flows.length === 1 && flows[0].token === token;

  let verb: Verb;
  if (!i.success) verb = "revert";
  else if (!to) verb = "deploy";
  else if (i.targetIsToken && onlyTokenIs(outs, null) && onlyTokenIs(ins, to)) verb = "wrap";
  else if (i.targetIsToken && onlyTokenIs(outs, to) && onlyTokenIs(ins, null)) verb = "unwrap";
  else if (has(/liquidat/)) verb = "liquidate";
  else if (has(/^repay/) && outs.length) verb = "repay";
  else if (has(/^borrow/) && ins.length) verb = "borrow";
  else if (has(/^(swap|tokenexchange|exchange)/) && (outs.length || ins.length)) verb = "swap";
  else if (has(/^(claim|harvest|rewardpaid|rewardsclaimed|getreward)/) && ins.length) verb = "claim";
  else if (has(/^(unstak|withdrawn|unbond|undelegat)/) && ins.length) verb = "unstake";
  else if (has(/^(stak|bond|delegat)/) && outs.length) verb = "stake";
  else if (has(/^(withdraw|redeem)/) && ins.length && !outs.some((f) => f.token === null)) verb = "withdraw";
  else if (has(/^(supply|deposit|mint)/) && outs.length) verb = "deposit";
  else if (has(/(bridge|tokenssent|tokensandcallsent|sendcrosschain|messagesent|sendwarpmessage)/) && outs.length) verb = "bridge";
  else if (outs.length && ins.length) verb = "swap";
  else if (outs.length) verb = "send";
  else if (ins.length) verb = "receive";
  else if (has(/^approval$/) && i.transfers.length === 0) verb = "approve";
  else verb = "call";

  // who the sentence is about: a plain transfer names its recipient, a
  // receipt names its source, everything else names the call target
  let counterparty: string | null = to;
  if (verb === "send") {
    const mine = i.transfers.filter((x) => x.from.toLowerCase() === actor);
    const dests = new Set(mine.map((x) => x.to.toLowerCase()));
    if (dests.size === 1) counterparty = [...dests][0];
    else if (mine.length === 0 && to) counterparty = to;
  } else if (verb === "receive") {
    const mine = i.transfers.filter((x) => x.to.toLowerCase() === actor);
    const srcs = new Set(mine.map((x) => x.from.toLowerCase()).filter((a) => a !== ZERO));
    if (srcs.size === 1) counterparty = [...srcs][0];
  } else if (verb === "deploy") {
    counterparty = i.contractAddress?.toLowerCase() ?? null;
  }

  const leadsWithOut = new Set<Verb>(["swap", "send", "repay", "deposit", "stake", "bridge", "wrap", "unwrap"]);
  const primary = leadsWithOut.has(verb) ? outs[0] ?? ins[0] ?? null : ins[0] ?? outs[0] ?? null;
  const secondary = verb === "swap" || verb === "wrap" || verb === "unwrap" ? ins[0] ?? null : null;

  return {
    verb,
    outs,
    ins,
    primary,
    secondary,
    counterparty,
    bystanders,
    movements: [...moves.entries()].map(([token, m]) => ({ token, ...m })).sort((a, b) => b.count - a.count),
    methodName: i.methodName,
    revertReason: i.revertReason ?? null,
  };
}

/** the verb as the sentence says it, past tense, with the preposition
 *  that joins it to the counterparty */
export const VERB_WORDS: Record<Verb, { past: string; join: string }> = {
  swap: { past: "swapped", join: "on" },
  send: { past: "sent", join: "to" },
  receive: { past: "received", join: "from" },
  repay: { past: "repaid", join: "to" },
  borrow: { past: "borrowed", join: "from" },
  deposit: { past: "deposited", join: "into" },
  withdraw: { past: "withdrew", join: "from" },
  claim: { past: "claimed", join: "from" },
  stake: { past: "staked", join: "with" },
  unstake: { past: "unstaked", join: "from" },
  bridge: { past: "bridged", join: "via" },
  liquidate: { past: "liquidated a position", join: "on" },
  wrap: { past: "wrapped", join: "" },
  unwrap: { past: "unwrapped", join: "" },
  approve: { past: "approved", join: "" },
  call: { past: "called", join: "on" },
  deploy: { past: "deployed a contract", join: "at" },
  revert: { past: "reverted", join: "on" },
};
