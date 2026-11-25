import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";
import { pchainPost } from "@/lib/pchain-rpc";

// Same-origin proxy to the AvalancheGo P-Chain RPC (the public RPC, then our
// dedicated node when the public one refuses: lib/pchain-rpc.ts). The indexer
// (Ash's explorer API) doesn't decode platform-op inputs (the initial
// validator set of a ConvertSubnetToL1Tx, subnet conversion state, live
// L1 validator sets), so the explorer enriches those views straight from
// the node. Read-only method allowlist.

const NETWORKS = new Set(["mainnet", "fuji"]);

const ALLOWED_METHODS = new Set([
  "platform.getTx",
  "platform.getSubnet",
  "platform.getCurrentValidators",
  // the node page's network-share denominator
  "platform.getTotalStake",
  // the L1s tab's continuous-fee price (ACP-77 fee market)
  "platform.getValidatorFeeState",
  // reward UTXOs are minted directly into state, never as tx outputs, so
  // the indexer can't see them: the tx page reads them off the node
  "platform.getRewardUTXOs",
  // resolves an ACP-77 validationID to the seat's nodeID: the indexer's
  // balance/disable tx rows carry only the validationID
  "platform.getL1Validator",
  // the time of the block a seat's balance was settled at, so the node
  // page can draw the balance down to now
  "platform.getBlockByHeight",
]);

// The route reads the method; the params go to the node as they are.
const bodySchema = z.object({
  method: z.string().optional(),
  params: z.unknown().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!NETWORKS.has(network)) {
    return NextResponse.json({ error: `no public RPC for network "${network}"` }, { status: 501 });
  }

  const body = await readJsonBody(req, bodySchema);
  if (!body) {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.method || !ALLOWED_METHODS.has(body.method)) {
    return NextResponse.json({ error: "method not allowed" }, { status: 400 });
  }

  try {
    const upstream = await pchainPost(network, { jsonrpc: "2.0", id: 1, method: body.method, params: body.params ?? {} }, 15_000);
    const json = await upstream.json();
    return NextResponse.json(json, {
      status: upstream.ok ? 200 : upstream.status,
      // decoded txs and conversion state are immutable once seen; validator
      // sets drift slowly: a short shared cache absorbs bursts either way
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    });
  } catch {
    return NextResponse.json({ error: "upstream RPC unreachable" }, { status: 502 });
  }
}
