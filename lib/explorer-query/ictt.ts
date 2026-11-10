/* Interchain Token Transfer (ICTT) and ICM as Query reads them, on the C-Chain, on every mainnet L1 and on the
   network. $ICTT(start), $ICTT(start, end) or $ICTT() (macros.ts) stands for a WITH of decoded events that stats-api
   writes out itself (/v2/query with the page's chainId, stats-api icm/ictt_expand.go): the registry of bridges, each
   home's token and what it holds, the window's sends and arrivals, and on the network the two sides of each transfer
   joined on the message ID. The query leaves this server with the shorthand as the writer typed it. A chain page sees
   its own side of a transfer only: the other side is on another chain's rows, which only the network target reads.
   Fuji stays as it was. */

import l1ChainsData from "@/constants/l1-chains.json";
import { TELEPORTER_ADDRESS, toHexBlockchainId } from "@/lib/icm-message";
import { familyQuestion } from "./families";
import { lendingQuestion } from "./lending";
import { mevQuestion } from "./mev";
import { FIRST_DAY, dexQuestion } from "./protocols";
import { icttAsked, icttBothSides, icttNamed } from "./names";
import { registryNames } from "./registry-turn";
import { NETWORK_ID, isFuji, targetOf } from "./target";

/** each event by topic0, keccak of its signature (checked with viem in tests/unit/explorer/query-ictt.test.ts) */
export const ICTT_TOPICS = {
  tokensSent: "93f19bf1ec58a15dc643b37e7e18a1c13e85e06cd11929e283154691ace9fb52",
  tokensAndCallSent: "5d76dff81bf773b908b050fa113d39f7d8135bb4175398f313ea19cd3a1a0b16",
  tokensRouted: "825080857c76cef4a1629c0705a7f8b4ef0282ddcafde0b6715c4fb34b68aaf0",
  tokensAndCallRouted: "42eff9005856e3c586b096d67211a566dc926052119fd7cc08023c70937ecb30",
  tokensWithdrawn: "6352c5382c4a4578e712449ca65e83cdb392d045dfcf1cad9615189db2da244b",
  callSucceeded: "104deb555f67e63782bb817bc26c39050894645f9b9f29c4be8ae68d0e8b7ff4",
  callFailed: "b9eaeae386d339f8115782f297a9e5f0e13fb587cd6b0d502f113cb8dd4d6cb0",
  remoteRegistered: "f229b02a51a4c8d5ef03a096ae0dd727d7b48b710d21b50ebebb560eef739b90",
  collateralAdded: "6769a5f9bfc8b6e0db839ab981cbf9239274ae72d2d035081a9157d43bd33cb6",
  sendMessage: "2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8",
  receiveMessage: "292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34",
  messageExecuted: "34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c",
  messageExecutionFailed: "4619adc1017b82e02eaefac01a43d50d6d8de4460774bc370c3ff0210d40c985",
  /** on the source chain, the destination's receipt for a message it received, which comes back with a later message */
  receiptReceived: "d13a7935f29af029349bed0a2097455b91fd06190a30478c575db3f31e00bf57",
  /** a wrapped native token's Deposit(address,uint256): a NativeTokenHome's send wraps the coin it takes */
  deposit: "e1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c",
} as const;

/** the chains the shorthand and the chapter serve: the network, and every EVM chain but Fuji's C-Chain and the
    catalog's testnets, whose Query stays as it was */
const TESTNETS: ReadonlySet<number> = new Set((l1ChainsData as { chainId: string; isTestnet?: boolean }[]).filter((c) => c.isTestnet === true).map((c) => Number(c.chainId)));
export function icttChain(chainId: number): boolean {
  return chainId === NETWORK_ID || (targetOf(chainId).kind === "evm" && !isFuji(chainId) && !TESTNETS.has(chainId));
}

/* ------------------------------------------------------------------ */
/* The parts stats-api writes out, as a query names them. Only the checks the guard needs before the query leaves:
   which parts a chain serves, and that the query reads one. */

/** the parts a query reads after $ICTT */
export const ICTT_PARTS = ["ictt_bridges", "ictt_tokens", "ictt_held", "ictt_sends", "ictt_arrivals", "ictt_transfers", "ictt_chains"] as const;
type Part = (typeof ICTT_PARTS)[number];
/** ictt_transfers is the network's, whose rows hold both sides; ictt_chains a chain page's, as the network has chain_names */
const served = (p: Part, chainId: number) => (p === "ictt_transfers" ? chainId === NETWORK_ID : p !== "ictt_chains" || chainId !== NETWORK_ID);

/** the parts this chain serves, which a query after $ICTT reads as tables */
export const icttServed = (chainId: number): Part[] => ICTT_PARTS.filter((p) => served(p, chainId));

/** the parts a query names, of the ones this chain serves */
function icttParts(sql: string, chainId: number): Part[] {
  return icttServed(chainId).filter((p) => new RegExp(`\\b${p}\\b`).test(sql));
}

/** stats-api's decoder, for the version of an ICTT question's prompt: bump it when stats-api changes what a part
    holds, so a kept answer is written again */
export const ICTT_VERSION = "stats-api-ictt-1";

/** each catalog chain's blockchain ID as 0x hex, which the chapter lists for a chain page */
const CHAIN_IDS: readonly { name: string; id: string }[] = (l1ChainsData as { chainId: string; chainName: string; blockchainId?: string; isTestnet?: boolean }[])
  .filter((c) => c.isTestnet !== true && c.blockchainId)
  .flatMap((c) => {
    const id = toHexBlockchainId(c.blockchainId!);
    return id ? [{ name: c.chainId === "43114" ? "C-Chain" : c.chainName, id }] : [];
  });

/** why the query after $ICTT cannot read its WITH, or null: it names none of the parts, ictt_transfers on a chain
    page, whose rows hold one side of a transfer, or ictt_chains on the network, which names chains with chain_names */
export function icttMisread(rest: string, chainId: number): string | null {
  const network = chainId === NETWORK_ID;
  if (/\bictt_transfers\b/.test(rest) && !network)
    return "ictt_transfers is the network's: a chain page holds one side of a transfer. Read ictt_sends for this chain's sends and ictt_arrivals for what arrived here; the page sends a question about both sides to every chain";
  if (/\bictt_chains\b/.test(rest) && network) return "ictt_chains is a chain page's: on the network, name a chain from chain_names, by its blockchain_id";
  if (icttParts(rest, chainId).length === 0) return `$ICTT stands for ${icttServed(chainId).join(", ")}: read one of them after it`;
  return null;
}

/* ------------------------------------------------------------------ */
/* What the writer is told: the chapter, in the prompt of an ICTT or ICM question (icttQuestion), so every other
   question's prompt is the one it was; its first rules again in the turn; and worked examples for each kind of
   target, each checked by the guard and the query service's screen (query-ictt.test.ts). Every part runs on the
   live index in tests/e2e/api/explorer-query-ictt.e2e.ts. */

/** a question that names ICTT or ICM, or has a bridge word (names.ts) and no other chapter, on a chain the shorthand
    serves. A DEX, lending, family or MEV question, or one that names a registry protocol, keeps the prompt it had:
    "swap volume of bridged tokens" and "bridged BTC borrowed" are about BTC.b and WETH.e, not ICTT */
const asked = (chainId: number, prompt: string) =>
  icttChain(chainId) &&
  (icttNamed(prompt) || (icttAsked(prompt) && ![dexQuestion, lendingQuestion, familyQuestion, mevQuestion].some((q) => q(chainId, prompt)) && registryNames(chainId, prompt).length === 0));

/** a question about ICTT or ICM, whose prompt carries the chapter: its words, or an earlier turn that read the
    shorthand's parts. Every other question's prompt is the one it was */
export function icttQuestion(chainId: number, prompt: string, history: { prompt?: string; sql?: string }[] = []): boolean {
  if (!icttChain(chainId)) return false;
  return asked(chainId, prompt) || history.some((turn) => asked(chainId, turn.prompt ?? "") || /\$ICTT\b|\bictt_(?:bridges|tokens|held|sends|arrivals|transfers|chains)\b/.test(turn.sql ?? ""));
}

/** the turn of an ICTT or ICM question: the chapter's first rules where the writer reads them (a rule in the system
    prompt alone held in 1 of 6 replays; in the turn, 6 of 6, mev.ts) */
export function icttTurn(chainId: number, prompt: string): string {
  if (!asked(chainId, prompt)) return "";
  const network = chainId === NETWORK_ID;
  const side = network
    ? " ictt_transfers holds both sides of each send; a destination the index does not hold shows its send side only, and the note says so. A token's transfers count both directions: key each send by its home (home_chain_id and home), never by role = 'home'."
    : ` This chain's tables hold its own side of a transfer or a message only${icttBothSides(prompt) ? ": answer that side, and the note says the other side is on the other chain's rows, which the network page reads" : ""}.`;
  return ` An ICTT or ICM question (the ICTT rules): a question about token bridges opens with $ICTT(start), $ICTT(start, end) or $ICTT() and reads its parts, never a bridge's own logs or Transfer logs. What the bridges hold now is ictt_held, after $ICTT(): one row per token, with its 0x address, its homes and its held_tokens (a USD stablecoin's is its USD; the page adds the rows up), never two other tokens added up. A ranking of tokens orders by transfers: two tokens' volumes are in different units and never compare.${side}`;
}

const hx = (c: string) => `lower(concat('0x', hex(${c})))`;
/** a chain page's other chain by its catalog name (ictt_chains AS c), or its blockchain ID where the catalog has none */
const named = (id: string) => `if(c.chain = '', ${hx(id)}, c.chain)`;
const icm = (k: keyof typeof ICTT_TOPICS) => `unhex('${ICTT_TOPICS[k]}')`;
/** the C-Chain's blockchain ID, which an L1's sends to it name */
const C_CHAIN_ID = "0427d4b22a2a78bcddd456742caf91b56badbff985ee19aef14573e7343fd652";
const NUMI_ID = "d32cc4660bcf8fa7971589f666fddb5ab22aee7e75dcb30b19829a65d4fb0063";
const USDC = "b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e";

/** the chapter's rules, for this chain or the network */
export function icttRules(chainId: number): string {
  const network = chainId === NETWORK_ID;
  const cchain = chainId === 43114;
  const own = network ? "every chain's, each row on its chain_id" : "this chain's";
  return `
## Interchain token transfers and ICM
Interchain Token Transfer (ICTT) is Avalanche's token bridge over ICM (Teleporter). A token home, on the token's own chain, locks the token; a token remote, on another chain, pays it out there (an ERC20TokenRemote is itself the token; a NativeTokenRemote pays the chain's native coin). One transfer is one ICM message: a send on the source chain and an arrival on the destination chain, with the same message ID. A transfer between two remotes goes through their home, which routes it on as a second message with a new ID.
- The shorthand. Open every query about these bridges with $ICTT(start), $ICTT(start, end) or $ICTT(), and our server writes a WITH of their decoded events in its place. Never write it out, never decode a bridge's logs with substring, and never read ERC-20 Transfer logs for a bridge. start and end are DateTimes, as for any window; ictt_sends and ictt_arrivals read that window, and with $ICTT() the whole history. ictt_bridges, ictt_tokens and ictt_held always read every block from the first day: a figure now opens with $ICTT(). After the shorthand comes SELECT, or , name AS (…) for a WITH of your own. Its parts, ${own} (addresses, IDs and hashes are bytes: compare them directly, return them with ${hx("x")}):
  - ictt_bridges: the registry, one row per remote a home registered: chain_id, home (the token home contract), remote_blockchain_id (the remote's chain, 32 bytes), token_remote (the remote contract there), remote_decimals, home_decimals, registered_at.
  - ictt_tokens: each home's token, named by the token's move into it on its first send or collateral: chain_id, home, token (the ERC-20 it holds; a NativeTokenHome's is its wrapped coin), decimals (the token's, ${cchain || network ? "from the C-Chain token list our server knows, else from the home's registration" : "from the home's registration"}: every row has it) and stable (true for a USD stablecoin${cchain || network ? " of the C-Chain list; false for every other token" : "; none of this chain's tokens is listed, so false"}). A home that never moved tokens (no send and no collateral) has no row, since no event names its token: a list of one token's bridges or registered homes leaves it out, and only such a list's note says a home that never moved tokens is not listed (it holds nothing, so a figure of what homes hold or send needs no such note).
  - ictt_held: what each home holds now, from its own events since the first day (a send or collateral locks its amount, an arrival or a fee releases one), one row per home with events (a home that never sent or took collateral holds nothing, and only ictt_bridges lists it): chain_id, home, token (NULL where no event named it), held (raw units), decimals, stable, held_tokens (held over 10^decimals; NULL where no event named the token).
  - ictt_sends: the window's sends: chain_id, block_time, block_number, tx (its transaction), bridge (the contract that sent), role ('home' or 'remote'), routed (true for a home's second hop), with_call (a send and call), message_id, sender (the zero address for a routed send), destination_blockchain_id, destination_bridge, recipient, amount, then home_chain_id and home: the token home the send belongs to, so one token is one key in both directions (a home's send names the home itself, a remote's send the home that registered the remote; ${network ? "NULL for a remote whose registration the index does not hold" : "NULL for a remote's send, as its home is on another chain's rows, which only the network page reads"}).
  - ictt_arrivals: the window's arrivals: chain_id, block_time, tx (its transaction), message_id, source_blockchain_id, bridge (the contract it arrived at), outcome ('withdrawn', 'call_succeeded', 'call_failed': the tokens went to the fallback recipient, 'routed': a home sent them on), recipient, amount.${
    network
      ? `
  - ictt_transfers: each of the window's sends with its arrival on any chain: the columns of ictt_sends (with home_chain_id and home), then destination_chain_id (0 with no arrival), delivered_at, destination_tx (the arrival's transaction), outcome, delivered_amount and status: 'delivered' (it paid out, or ran on a retry after it failed), 'call_failed', 'routed', 'execution_failed' (the message failed to run, and no retry ran it), 'received' (the source chain holds the destination's receipt, so it arrived, but the index holds no row of its arrival: count it as delivered, its outcome unknown), 'undelivered' (its destination chain is indexed and holds no arrival and no receipt: say not yet delivered, never waiting or pending) or 'destination_not_indexed' (no arrival and no receipt, to a chain the index does not hold).`
      : `
  - ictt_chains: the indexed chains, to name the other chain: blockchain_id (32 bytes), chain (its name). A chain the index does not hold has no row, so a LEFT JOIN names it by its blockchain ID.`
  }
- Units. Amounts are raw, in the token of their leg: a home's send is in the units of the remote it goes to, a remote's send in the remote's own units, and an arrival in the units of the bridge it arrived at. A home's token is ictt_tokens.token, and a remote is its own token. remote_decimals = home_decimals on every bridge registered so far, so an amount of a token in either direction over pow(10, decimals) of its home's token is in tokens. Add up the amounts of one token only (its homes and their remotes, or one bridge); never two tokens. ${network ? "Every send with a home has its decimals through ictt_tokens" : "A remote's decimals are on its home's rows, another chain's: for a remote's token count transfers, or return the raw sum named amount_raw"}. A USD stablecoin (stable) is 1 token = 1 USD, so the stablecoins' held_tokens add up in USD (name it held_usd).
- What a bridge holds, locks or has as TVL now is ictt_held, never Transfer logs or a token's balance, and its note says it is counted from the bridges' own events.
- ${
    network
      ? "A token's transfers and volume count both directions: a send from a home, and a send from a remote back toward its home. Key each send by its home: join ictt_tokens on chain_id = home_chain_id and home = home, and group by home_chain_id and the token. Never filter role = 'home', which leaves out every transfer toward the home. Leave out routed sends (NOT routed): a routed send is the second hop of a transfer already counted. A transfer from a chain the index does not hold has no send, only its arrival, so the note says such transfers are not counted. Rank tokens by transfers, even for a question about volume: each token's volume is in its own units, so two tokens' volumes never compare, and no ORDER BY or chart sets them side by side."
      : "A token's transfers and volume on this chain count both directions: its sends from this chain (NOT routed: a routed send is the second hop of an arrival already counted) and its arrivals here, each keyed by the home's token (ifNull(k.token, bridge) with LEFT JOIN ictt_tokens AS k ON k.home = bridge: a remote is its own token), as the worked example does. Rank tokens by transfers, even for a question about volume: each token's volume is in its own units, so two tokens' volumes never compare, and no ORDER BY or chart sets them side by side. The note says amounts are shown only for the tokens Query knows."
  }
- A chart draws figures of one unit: held_usd, or transfers. A count beside a figure in USD or tokens (homes, senders) stays in the rows and out of the chart's series, and so does an amount in each token's own units, which no two rows share.${
    network
      ? `
- Name chains with chain_names: a source by chain_id, a destination by blockchain_id = destination_blockchain_id (LEFT JOIN, and its blockchain ID as ${hx("x.destination_blockchain_id")} where it has no name). A chain chain_names does not hold (CX, Henesys and others the index does not hold) shows the send side only: its transfers are received where the source chain holds the receipt, else destination_not_indexed, and the note says so.
- ICM messages: SendCrossChainMessage on the source chain and ReceiveCrossChainMessage on the destination chain share topic1, the message ID; MessageExecuted (topic1 the ID) follows a message that ran, and MessageExecutionFailed one that failed, on the destination. A message's delivery is its receive, joined on topic1, or else ReceiptReceived ${icm("receiptReceived")} on the source chain with the same topic1, the destination's receipt (it comes back with a later message, so a message with none may still have arrived). One message's lookup reads those five topics with topic1 = unhex('…the ID…') from ${FIRST_DAY}, since they are rare topics. A chain's own messages (Dexalot's) are its sends and its receives, both on its chain_id. Count messages by distinct topic1 (uniqExactIf), never logs: a retried send logs SendCrossChainMessage again with the same ID.`
      : `
- This chain's tables hold its own side of each transfer and message: a send's arrival, and an arrival's send, are on the other chain's rows, which only the network page reads. A question about delivery, both sides or a route answers this chain's side, and the note says so. One message's lookup reads the ICM topics with topic1 = unhex('…the ID…') from ${FIRST_DAY}, since they are rare topics. Count messages by distinct topic1 (uniqExactIf), never logs: a retried send logs SendCrossChainMessage again with the same ID.
- The other chain is named by its blockchain ID. The catalog's chains: ${CHAIN_IDS.map((c) => `${c.name} ${c.id}`).join("; ")}. Name a chain the question does not name with ictt_chains, as the network page does with its chain list: LEFT JOIN ictt_chains AS c ON c.blockchain_id = x.destination_blockchain_id (or source_blockchain_id, remote_blockchain_id), then if(c.chain = '', ${hx("x.destination_blockchain_id")}, c.chain) AS destination_chain, since a chain outside the catalog has no name.`
  }
`;
}

/** the chapter's worked examples, for this chain or the network */
export function icttExamples(chainId: number): string {
  if (chainId === NETWORK_ID) return NETWORK_EXAMPLES.map((e) => `${e}\n\n`).join("");
  const c = chainId;
  const blocks =
    c === 43114
      ? [
          `The USD stablecoins the ICTT bridges on this chain hold now, per token, with the homes that hold each (a figure now opens with $ICTT()); held_usd alone is the chart's series, as homes is a count; drill into one token's homes:
$ICTT() SELECT ${hx("token")} AS token_address, count() AS homes, round(sum(held_tokens), 2) AS held_usd FROM ictt_held WHERE stable GROUP BY token ORDER BY held_usd DESC
drill: $ICTT() SELECT ${hx("home")} AS home_address, held_tokens AS held_now FROM ictt_held WHERE token = {{token_address:bytes}} ORDER BY held_now DESC LIMIT 50`,
          `The ICTT bridges of one token on this chain (here USDC): each home, the remotes it registered, their chains (named where the catalog names them) and what the home holds; a home that never moved tokens has no event that names its token, so it is not listed, and the note says so; the rows are bridges, so no drill:
$ICTT() SELECT ${hx("b.home")} AS home_address, ${named("b.remote_blockchain_id")} AS remote_chain, ${hx("b.token_remote")} AS remote_address, b.registered_at AS registered_at, h.held_tokens AS home_holds FROM ictt_bridges AS b INNER JOIN ictt_held AS h ON h.chain_id = b.chain_id AND h.home = b.home LEFT JOIN ictt_chains AS c ON c.blockchain_id = b.remote_blockchain_id WHERE h.token = unhex('${USDC}') ORDER BY home_holds DESC, registered_at`,
          `The ICTT tokens with the most transfers on this chain in the last 30 days, in both directions: sent from it and arrived at it (a home's token, or a remote, its own token), with their amounts where the token's decimals are known, ranked by transfers (no two tokens' amounts compare), and transfers alone as the chart's series; drill into one token's transfers:
$ICTT(now() - INTERVAL 30 DAY) SELECT ${hx("ifNull(k.token, x.bridge)")} AS token_address, count() AS transfers, countIf(x.outbound) AS sent, countIf(NOT x.outbound) AS arrived, sum(x.amount) / pow(10, any(k.decimals)) AS amount_tokens, round(100 * count() / sum(count()) OVER (), 2) AS share_pct, count() OVER () AS of_total FROM (SELECT bridge, true AS outbound, amount FROM ictt_sends WHERE NOT routed UNION ALL SELECT bridge, false AS outbound, amount FROM ictt_arrivals) AS x LEFT JOIN ictt_tokens AS k ON k.home = x.bridge GROUP BY token_address ORDER BY transfers DESC LIMIT 15
drill: $ICTT(now() - INTERVAL 30 DAY) SELECT x.block_time AS t, x.direction AS direction, ${hx("x.tx")} AS tx_hash, ${hx("x.other")} AS other_chain, x.amount AS amount_raw FROM (SELECT block_time, tx, bridge, 'sent' AS direction, destination_blockchain_id AS other, amount FROM ictt_sends WHERE NOT routed UNION ALL SELECT block_time, tx, bridge, 'arrived' AS direction, source_blockchain_id AS other, amount FROM ictt_arrivals) AS x LEFT JOIN ictt_tokens AS k ON k.home = x.bridge WHERE ifNull(k.token, x.bridge) = {{token_address:bytes}} ORDER BY t DESC LIMIT 50`,
        ]
      : [];
  const other = c === 43114 ? { name: "Numi", id: NUMI_ID } : { name: "the C-Chain", id: C_CHAIN_ID };
  const snake = other.name.replace(/^the /, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  blocks.push(
    `ICTT transfers between this chain and ${other.name} per day in the last 7 days: sent to it, and arrived from it; drill into one day's sends:
$ICTT(toStartOfDay(now()) - INTERVAL 7 DAY) SELECT toDate(block_time) AS t, countIf(kind = 'sent') AS sent_to_${snake}, countIf(kind = 'arrived') AS arrived_from_${snake} FROM (SELECT block_time, 'sent' AS kind FROM ictt_sends WHERE destination_blockchain_id = unhex('${other.id}') UNION ALL SELECT block_time, 'arrived' AS kind FROM ictt_arrivals WHERE source_blockchain_id = unhex('${other.id}')) GROUP BY t ORDER BY t WITH FILL FROM toDate(now()) - 7 TO toDate(now()) + 1
drill: $ICTT(toStartOfDay(now()) - INTERVAL 7 DAY) SELECT s.block_time AS t, ${hx("s.tx")} AS tx_hash, ${hx("s.sender")} AS from_address, ${hx("s.recipient")} AS to_address, ${hx("s.bridge")} AS bridge_address, s.amount AS amount_raw FROM ictt_sends AS s WHERE s.destination_blockchain_id = unhex('${other.id}') AND toDate(s.block_time) = {{t}} ORDER BY t DESC LIMIT 50`,
    `ICTT transfers this chain sent in the last 7 days, per bridge and destination chain (named where the catalog names it), with their raw amounts (each bridge its own token, so no two rows add up); drill into one bridge's sends:
$ICTT(now() - INTERVAL 7 DAY) SELECT ${hx("s.bridge")} AS bridge_address, s.role AS role, ${named("s.destination_blockchain_id")} AS destination_chain, count() AS transfers, uniqExact(s.sender) AS senders, sum(s.amount) AS amount_raw FROM ictt_sends AS s LEFT JOIN ictt_chains AS c ON c.blockchain_id = s.destination_blockchain_id GROUP BY s.bridge, s.role, destination_chain ORDER BY transfers DESC
drill: $ICTT(now() - INTERVAL 7 DAY) SELECT s.block_time AS t, ${hx("s.tx")} AS tx_hash, ${hx("s.sender")} AS from_address, ${hx("s.recipient")} AS to_address, s.amount AS amount_raw FROM ictt_sends AS s WHERE s.bridge = {{bridge_address:bytes}} ORDER BY t DESC LIMIT 50`,
  );
  return blocks.map((b) => `${b}\n\n`).join("");
}

const NAMED_ROUTE = "INNER JOIN chain_names AS s ON s.chain_id = x.chain_id LEFT JOIN chain_names AS d ON d.blockchain_id = x.destination_blockchain_id";
const DESTINATION = `if(d.chain = '', ${hx("x.destination_blockchain_id")}, d.chain) AS destination_chain`;
/** a send's token, by its home on any chain */
const HOME_TOKEN = "INNER JOIN ictt_tokens AS k ON k.chain_id = s.home_chain_id AND k.home = s.home";
const NETWORK_EXAMPLES = [
  `ICTT transfers between chains this week, per source and destination, delivered (or received, by the source's receipt) and not yet; drill into one route's transfers:
$ICTT(toMonday(now())) SELECT s.chain AS source_chain, x.chain_id AS chain_id, ${DESTINATION}, ${hx("x.destination_blockchain_id")} AS destination_id, count() AS transfers, countIf(x.status IN ('delivered', 'received')) AS delivered, countIf(x.status = 'undelivered') AS not_yet_delivered, countIf(x.status = 'destination_not_indexed') AS destination_not_indexed FROM ictt_transfers AS x ${NAMED_ROUTE} GROUP BY source_chain, chain_id, destination_chain, destination_id ORDER BY transfers DESC
drill: $ICTT(toMonday(now())) SELECT x.block_time AS sent_at, x.chain_id AS chain_id, ${hx("x.tx")} AS tx_hash, ${hx("x.message_id")} AS message, ${hx("x.sender")} AS from_address, ${hx("x.recipient")} AS to_address, x.amount AS amount_raw, x.status AS status, ${hx("x.destination_tx")} AS destination_tx_hash FROM ictt_transfers AS x WHERE x.chain_id = {{chain_id}} AND x.destination_blockchain_id = {{destination_id:bytes}} ORDER BY sent_at DESC LIMIT 50`,
  `One ICTT transfer traced by its message ID over the whole history: its source transaction, sender, recipient and amount, and where, when and how it arrived; the rows are transfers, so no drill:
$ICTT() SELECT s.chain AS source_chain, x.chain_id AS chain_id, x.block_time AS sent_at, ${hx("x.tx")} AS tx_hash, ${hx("x.message_id")} AS message, ${hx("x.sender")} AS from_address, ${hx("x.recipient")} AS to_address, x.amount AS amount_raw, ${DESTINATION}, x.delivered_at AS delivered_at, ${hx("x.destination_tx")} AS destination_tx_hash, x.outcome AS outcome, x.status AS status FROM ictt_transfers AS x ${NAMED_ROUTE} WHERE x.message_id = unhex('9205afdee4202e45e70d90d267f0893d75cead6870abde86b25129c0f247b97c')`,
  `The ICTT transfers of the last 7 days that are not yet delivered (their destination is indexed and holds no arrival), oldest first; the rows are transfers, so no drill:
$ICTT(now() - INTERVAL 7 DAY) SELECT x.block_time AS sent_at, x.chain_id AS chain_id, s.chain AS source_chain, ${DESTINATION}, ${hx("x.tx")} AS tx_hash, ${hx("x.message_id")} AS message, x.amount AS amount_raw, dateDiff('minute', x.block_time, now()) AS minutes_since_sent FROM ictt_transfers AS x ${NAMED_ROUTE} WHERE x.status = 'undelivered' ORDER BY sent_at`,
  `ICTT tokens by transfers and volume in the last 30 days, in both directions (a send from a home, and a send from a remote back toward its home), one row per token, named by its home's token address and home chain, ranked by transfers (no two tokens' volumes compare), and transfers alone as the chart's series; a transfer from a chain the index does not hold has no send, so the note says such transfers are not counted; drill into one token's sends:
$ICTT(now() - INTERVAL 30 DAY) SELECT n.chain AS home_chain, s.home_chain_id AS chain_id, ${hx("k.token")} AS token_address, count() AS transfers, countIf(s.role = 'home') AS from_home, countIf(s.role = 'remote') AS from_remotes, uniqExact(s.sender) AS senders, sum(s.amount) / pow(10, any(k.decimals)) AS volume_tokens, round(100 * count() / sum(count()) OVER (), 2) AS share_pct, count() OVER () AS of_total FROM ictt_sends AS s ${HOME_TOKEN} INNER JOIN chain_names AS n ON n.chain_id = s.home_chain_id WHERE NOT s.routed GROUP BY home_chain, s.home_chain_id, k.token ORDER BY transfers DESC LIMIT 15
drill: $ICTT(now() - INTERVAL 30 DAY) SELECT s.block_time AS sent_at, n.chain AS source_chain, s.chain_id AS chain_id, s.role AS role, ${hx("s.tx")} AS tx_hash, ${hx("s.sender")} AS from_address, ${hx("s.recipient")} AS to_address, s.amount / pow(10, k.decimals) AS amount_tokens FROM ictt_sends AS s ${HOME_TOKEN} INNER JOIN chain_names AS n ON n.chain_id = s.chain_id WHERE NOT s.routed AND s.home_chain_id = {{chain_id}} AND k.token = {{token_address:bytes}} ORDER BY sent_at DESC LIMIT 50`,
  `The USD stablecoins the ICTT bridges hold now, per chain and token (a figure now opens with $ICTT()); held_usd alone is the chart's series, as homes is a count:
$ICTT() SELECT n.chain AS chain, h.chain_id AS chain_id, ${hx("h.token")} AS token_address, count() AS homes, round(sum(h.held_tokens), 2) AS held_usd FROM ictt_held AS h INNER JOIN chain_names AS n ON n.chain_id = h.chain_id WHERE h.stable GROUP BY chain, chain_id, token_address ORDER BY held_usd DESC`,
  `The ICM messages one chain (here Dexalot, 432204) sent and received this week, and how many of those it received ran and failed, each message once (a retried send logs again; ICM, not ICTT: no shorthand):
SELECT uniqExactIf(topic1, topic0 = ${icm("sendMessage")}) AS sent, uniqExactIf(topic1, topic0 = ${icm("receiveMessage")}) AS received, uniqExactIf(topic1, topic0 = ${icm("messageExecuted")}) AS ran, uniqExactIf(topic1, topic0 = ${icm("messageExecutionFailed")}) AS failed FROM raw_logs WHERE chain_id = 432204 AND block_time >= toMonday(now()) AND address = unhex('${TELEPORTER_ADDRESS.slice(2)}') AND topic0 IN (${(["sendMessage", "receiveMessage", "messageExecuted", "messageExecutionFailed"] as const).map(icm).join(", ")})`,
];
