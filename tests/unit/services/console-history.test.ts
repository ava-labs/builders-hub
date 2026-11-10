import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* An in-memory stand-in for the three tables. It reads the where shapes the
   service sends (equality, not null, lt/lte/gte/gt, OR, contains) and sorts
   by created_at desc, then id asc, as Postgres does for these ids. */
type Row = Record<string, unknown> & { id: string; user_id: string; created_at: Date };

const { tables, sessionMock } = vi.hoisted(() => ({
  tables: { consoleLog: [] as Row[], faucetClaim: [] as Row[], nodeRegistration: [] as Row[] },
  sessionMock: vi.fn(),
}));

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, cond]) => {
    if (field === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(row, w));
    const value = row[field];
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (cond && typeof cond === "object") {
      return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
        const a = value instanceof Date ? value.getTime() : value;
        const b = arg instanceof Date ? arg.getTime() : arg;
        switch (op) {
          case "not":
            return a !== b;
          case "lt":
            return (a as number) < (b as number);
          case "lte":
            return (a as number) <= (b as number);
          case "gte":
            return (a as number) >= (b as number);
          case "gt":
            return (a as string) > (b as string);
          case "contains":
            return typeof a === "string" && a.includes(b as string);
          default:
            throw new Error(`fake prisma: no ${op}`);
        }
      });
    }
    return value === cond;
  });
}

function table(name: keyof typeof tables) {
  return {
    findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) => {
      const rows = tables[name]
        .filter((r) => matches(r, where))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return take ? rows.slice(0, take) : rows;
    }),
  };
}

vi.mock("@/prisma/prisma", () => ({
  prisma: {
    consoleLog: table("consoleLog"),
    faucetClaim: table("faucetClaim"),
    nodeRegistration: table("nodeRegistration"),
  },
}));
vi.mock("@/lib/auth/authSession", () => ({ getAuthSession: sessionMock }));

import {
  cchainTxHref,
  clampLimit,
  consoleActionTitle,
  consoleItem,
  decodeCursor,
  encodeCursor,
  getConsoleHistory,
  InvalidCursorError,
  pchainTxHref,
  safeErrorText,
} from "@/server/services/console-history";
import { GET } from "@/app/api/profile/console-history/route";

const EVM_TX = `0x${"ab".repeat(32)}`;
const EVM_TX_2 = `0x${"cd".repeat(32)}`;
const PCHAIN_TX = "2kQ8n7wLx9vB3cD4eF5gH6jK7mN8pQ9rS1tU2vW3xY4zA5bC6d";
const at = (iso: string) => new Date(iso);

beforeEach(() => {
  tables.consoleLog = [];
  tables.faucetClaim = [];
  tables.nodeRegistration = [];
  sessionMock.mockReset().mockResolvedValue({ user: { id: "u1" } });
});

describe("consoleActionTitle", () => {
  it.each([
    ["layer-1/create/chain_created", "success", "Chain created"],
    ["layer-1/create/subnet_created", "success", "L1 created"],
    ["layer-1/convert/l1_conversion", "error", "Could not convert to L1"],
    ["primary-network/cross_chain_import", "success", "Cross-chain import completed"],
    ["permissioned-l1s/setup/validator_weight_set", "success", "Validator weight set"],
    ["permissioned-l1s/setup/deploy/validatormanager", "success", "Deployed validator manager"],
    ["ictt/deploy/contract/deploy/erc20tokenstakingmanager", "error", "Could not deploy ERC20 token staking manager"],
    ["setup/deploy/exampleerc20_(mintable)", "success", "Deployed example ERC20 (mintable)"],
    ["validator-manager/deploy/contract/validator_manager", "success", "Deployed validator manager"],
    ["ictt/deploy/contract/erc20_token_home", "error", "Could not deploy ERC20 token home"],
    ["setup/call/initialize", "success", "Called initialize"],
    ["setup/call/initialize", "error", "Could not call initialize"],
    [
      "staking/call/complete_validator_registration_(erc20_staking)",
      "success",
      "Completed validator registration (ERC20 staking)",
    ],
    [
      "staking/call/complete_validator_registration_(erc20_staking)",
      "error",
      "Could not complete validator registration (ERC20 staking)",
    ],
    ["icm/transfer/send_native_coin", "success", "Sent native coin"],
    ["icm/transfer/send_native_coin", "error", "Could not send native coin"],
    ["icm/call/send_icm_message", "success", "Sent ICM message"],
    ["icm/call/send_icm_message", "error", "Could not send ICM message"],
    ["setup/local/aggregate_signatures", "success", "Aggregated signatures"],
    ["setup/local/aggregate_signatures", "error", "Could not aggregate signatures"],
    ["setup/local/deploy_poamanager", "success", "Deployed PoA manager"],
    ["setup/local/deploy_poamanager", "error", "Could not deploy PoA manager"],
    ["setup/transfer/advance_p-chain_view", "success", "Advanced P-Chain view"],
    ["setup/call/grant_minter_role", "success", "Granted minter role"],
    ["validator/local/remove_subnet_validator", "success", "Removed L1 validator"],
    ["primary-network/local/p-chain_avax_faucet_claim", "success", "Received tokens from the faucet"],
    ["primary-network/local/p-chain_manual_faucet_claim", "error", "Could not receive tokens from the faucet"],
    ["primary-network/local/fuji_c-chain_faucet_claim", "success", "Received tokens from the faucet"],
    ["primary-network/faucet/claim/fuji_c_chain", "success", "Received tokens from the faucet"],
    ["testnet-infra/local/managed_testnet_node_creation", "success", "Node created"],
    ["testnet-infra/local/managed_testnet_node_creation", "error", "Could not create the node"],
    ["testnet-infra/local/managed_testnet_relayer_deletion", "success", "Relayer deleted"],
    // a name that starts with no known verb keeps its words
    ["upgrade/local/managed_upgrade.json_write", "success", "Managed upgrade.json write"],
    ["upgrade/local/managed_upgrade.json_write", "error", "Managed upgrade.json write failed"],
  ])("%s (%s) reads %j", (path, status, title) => {
    expect(consoleActionTitle(path, status)).toBe(title);
  });

  it("moves the chain of a faucet claim into the detail, then the error text", () => {
    const row = (action_path: string, status: string, data: unknown) =>
      consoleItem({ id: "r", status, action_path, data: data as never, created_at: at("2026-10-01T00:00:00.000Z") });
    const result = JSON.stringify({ success: true, txID: PCHAIN_TX });
    expect(row("pn/local/p-chain_manual_faucet_claim", "success", { result, network: "testnet" })).toMatchObject({
      title: "Received tokens from the faucet",
      detail: "P-Chain",
    });
    expect(row("pn/local/fuji_c-chain_faucet_claim", "success", { result, network: "testnet" }).detail).toBe("C-Chain");
    expect(row("pn/local/echo_faucet_claim", "success", { result, network: "testnet" }).detail).toBe("Echo");
    expect(row("pn/local/p-chain_avax_faucet_claim", "error", { error: "Rate limited", network: "testnet" })).toMatchObject({
      title: "Could not receive tokens from the faucet",
      detail: "P-Chain: Rate limited",
    });
    // "avax" goes only from a primary chain name: an L1 can carry it
    expect(row("pn/local/avax_gaming_faucet_claim", "success", { result, network: "testnet" }).detail).toBe(
      "AVAX gaming",
    );
    expect(row("x/transfer/send_native_coin", "success", { network: "testnet" }).detail).toBeNull();
    expect(consoleActionTitle("x/call/transfer_from_erc20_token", "success")).toBe(
      "Sent ERC20 tokens from an approved address",
    );
    expect(consoleActionTitle("x/call/transfer_from_erc20_token", "error")).toBe(
      "Could not send ERC20 tokens from an approved address",
    );
  });

  it("reads an Object.prototype name as a plain name", () => {
    expect(consoleActionTitle("a/constructor", "success")).toBe("Constructor");
    expect(consoleActionTitle("a/local/constructor_x", "error")).toBe("Constructor x failed");
    expect(consoleActionTitle("a/local/tostring_hasownproperty", "success")).toBe("Tostring hasownproperty");
  });

  it("names a row with no path", () => {
    expect(consoleActionTitle(null, "success")).toBe("Console action");
    expect(consoleActionTitle("", "error")).toBe("Console action failed");
  });

  it("never shows the word subnet", () => {
    for (const p of [
      "a/subnet_created",
      "a/subnet_validator_removed",
      "a/b/convert_subnet_to_l1",
      "a/local/subnet_thing",
      "a/call/subnets_of_subnetid",
      "a/deploy/subnet-evm_config",
    ]) {
      expect(consoleActionTitle(p, "success").toLowerCase()).not.toContain("subnet");
      expect(consoleActionTitle(p, "error").toLowerCase()).not.toContain("subnet");
    }
  });
});

describe("explorer links", () => {
  it("links a valid hash on the C-Chains only", () => {
    expect(cchainTxHref(EVM_TX, 43114)).toBe(`/explorer/mainnet/c-chain/tx/${EVM_TX}`);
    expect(cchainTxHref(EVM_TX, 43113)).toBe(`/explorer/fuji/c-chain/tx/${EVM_TX}`);
    expect(cchainTxHref(EVM_TX, 779672)).toBeNull();
  });

  it.each([["javascript:alert(1)"], [`${EVM_TX}/../../admin`], ["0x1234"], [`0x${"zz".repeat(32)}`], [42], [null]])(
    "gives no link for the bad hash %j",
    (hash) => {
      expect(cchainTxHref(hash, 43113)).toBeNull();
      expect(pchainTxHref(hash, "testnet")).toBeNull();
    },
  );

  it("links a P-Chain id by its network, and none without one", () => {
    expect(pchainTxHref(PCHAIN_TX, "mainnet")).toBe(`/explorer/mainnet/p-chain/tx/${PCHAIN_TX}`);
    expect(pchainTxHref(PCHAIN_TX, "testnet")).toBe(`/explorer/fuji/p-chain/tx/${PCHAIN_TX}`);
    expect(pchainTxHref(PCHAIN_TX, null)).toBeNull();
    expect(pchainTxHref("0OIl" + PCHAIN_TX.slice(4), "testnet")).toBeNull();
  });

  it("reads untrusted data without a link to a bad hash, and gives a cross-chain id no P-Chain link", () => {
    const row = (action_path: string, data: unknown) => ({
      id: "r",
      status: "success",
      action_path,
      data: data as never,
      created_at: at("2026-10-01T00:00:00.000Z"),
    });
    const bad = consoleItem(row("x/call/send", { txHash: "<img src=x>", chainId: 43113, network: "testnet" }));
    expect(bad.href).toBeNull();
    expect(bad.hash).toBeNull();
    const cross = consoleItem(row("x/cross_chain_import", { txID: PCHAIN_TX, network: "testnet" }));
    expect(cross.hash).toBe(PCHAIN_TX);
    expect(cross.href).toBeNull();
    const pchain = consoleItem(row("x/validator_registered", { txID: PCHAIN_TX, network: "mainnet" }));
    expect(pchain.href).toBe(`/explorer/mainnet/p-chain/tx/${PCHAIN_TX}`);
    const deploy = consoleItem(
      row("x/deploy/proxyadmin", {
        txHash: EVM_TX,
        address: `0x${"1".repeat(40)}`,
        chainId: 43114,
        network: "mainnet",
      }),
    );
    expect(deploy).toMatchObject({ address: `0x${"1".repeat(40)}`, href: `/explorer/mainnet/c-chain/tx/${EVM_TX}` });
    // the chain id decides the network, so the tag and the link agree
    const mixed = consoleItem(row("x/call/send", { txHash: EVM_TX, chainId: 43114, network: "testnet" }));
    expect(mixed).toMatchObject({ network: "mainnet", href: `/explorer/mainnet/c-chain/tx/${EVM_TX}` });
    const l1 = consoleItem(row("x/call/send", { txHash: EVM_TX, chainId: 779672, network: "testnet" }));
    expect(l1).toMatchObject({ network: "testnet", href: null, hash: EVM_TX });
  });

  it("cuts an error to one safe line of at most 140 characters", () => {
    expect(safeErrorText("User rejected the request.\n\nRequest Arguments:\n  from: 0x1")).toBe(
      "User rejected the request.",
    );
    const long = safeErrorText("x".repeat(500));
    expect(long).toHaveLength(140);
    expect(safeErrorText("bad\u0000\u0007text")).toBe("bad text");
    expect(safeErrorText({ message: "no" })).toBeNull();
  });
});

describe("limit and cursor", () => {
  it.each([
    [undefined, 20],
    [null, 20],
    ["abc", 20],
    ["", 20],
    ["0", 1],
    [-5, 1],
    ["7", 7],
    [7.9, 7],
    ["51", 50],
    [1000, 50],
  ])("clamps %j to %i", (raw, limit) => {
    expect(clampLimit(raw)).toBe(limit);
  });

  it("round-trips a cursor and rejects a malformed one", () => {
    const key = { createdAt: at("2026-10-01T12:00:00.123Z"), source: "faucet" as const, id: 'a|b"c' };
    expect(decodeCursor(encodeCursor(key))).toEqual(key);
    const bad = [
      "not base64!",
      Buffer.from("{}").toString("base64url"),
      Buffer.from(JSON.stringify(["2026-13-01", "console", "x"])).toString("base64url"),
      Buffer.from(JSON.stringify(["2026-10-01T00:00:00.000Z", "wallet", "x"])).toString("base64url"),
      Buffer.from(JSON.stringify(["2026-10-01T00:00:00.000Z", "console", ""])).toString("base64url"),
    ];
    for (const raw of bad) expect(() => decodeCursor(raw)).toThrow(InvalidCursorError);
  });
});

/* ------------------------------------------------------------------ */
const log = (id: string, iso: string, action_path: string, data: unknown, status = "success", user_id = "u1"): Row => ({
  id,
  user_id,
  status,
  action_path,
  data,
  created_at: at(iso),
});
const claim = (
  id: string,
  iso: string,
  tx_hash: string | null,
  faucet_type = "evm",
  chain_id: string | null = "43113",
): Row => ({
  id,
  user_id: "u1",
  faucet_type,
  chain_id,
  amount: "2",
  tx_hash,
  created_at: at(iso),
});
const node = (id: string, iso: string, status = "active"): Row => ({
  id,
  user_id: "u1",
  chain_name: "Docs Chain",
  status,
  created_at: at(iso),
  expires_at: at("2099-01-01T00:00:00.000Z"),
});

describe("getConsoleHistory: merge and dedup", () => {
  it("merges the three sources newest first, for the given user only", async () => {
    tables.consoleLog = [
      log("c1", "2026-10-03T00:00:00.000Z", "a/chain_created", { txID: PCHAIN_TX, network: "testnet" }),
      log("c-other", "2026-10-04T00:00:00.000Z", "a/chain_created", {}, "success", "u2"),
    ];
    tables.faucetClaim = [
      claim("f1", "2026-10-02T00:00:00.000Z", EVM_TX),
      claim("f-pending", "2026-10-05T00:00:00.000Z", null),
    ];
    tables.nodeRegistration = [node("n1", "2026-10-01T00:00:00.000Z", "terminated")];

    const page = await getConsoleHistory("u1", { limit: 10 });
    expect(page.items.map((i) => i.id)).toEqual(["console:c1", "faucet:f1", "node:n1"]);
    expect(page.nextCursor).toBeNull();
    expect(page.items[1]).toMatchObject({
      title: "Received 2 AVAX from the faucet",
      detail: "C-Chain",
      network: "testnet",
      href: `/explorer/fuji/c-chain/tx/${EVM_TX}`,
    });
    expect(page.items[2]).toMatchObject({
      title: "Node created",
      status: "info",
      detail: "Docs Chain. Status: terminated.",
    });
  });

  it("skips a faucet claim that a Console row already shows", async () => {
    tables.consoleLog = [
      log("c1", "2026-10-02T00:00:05.000Z", "primary-network/local/p-chain_avax_faucet_claim", {
        result: JSON.stringify({ success: true, txID: PCHAIN_TX }),
        network: "testnet",
      }),
      log("c2", "2026-10-02T00:01:05.000Z", "primary-network/local/fuji_c-chain_faucet_claim", {
        result: JSON.stringify({ success: true, txHash: EVM_TX.toUpperCase().replace("0X", "0x") }),
        network: "testnet",
      }),
    ];
    tables.faucetClaim = [
      claim("f1", "2026-10-02T00:00:00.000Z", PCHAIN_TX, "pchain", null),
      claim("f2", "2026-10-02T00:01:00.000Z", EVM_TX),
      claim("f3", "2026-10-01T00:00:00.000Z", EVM_TX_2),
    ];
    const page = await getConsoleHistory("u1", { limit: 10 });
    expect(page.items.map((i) => i.id)).toEqual(["console:c2", "console:c1", "faucet:f3"]);
    expect(page.items[1].href).toBe(`/explorer/fuji/p-chain/tx/${PCHAIN_TX}`);
  });

  it("skips the claim when its Console row sits on an earlier page", async () => {
    tables.consoleLog = [
      log("c1", "2026-10-02T00:00:05.000Z", "primary-network/local/p-chain_avax_faucet_claim", {
        result: JSON.stringify({ txID: PCHAIN_TX }),
        network: "testnet",
      }),
    ];
    tables.faucetClaim = [
      claim("f1", "2026-10-02T00:00:00.000Z", PCHAIN_TX, "pchain", null),
      claim("f0", "2026-10-01T00:00:00.000Z", EVM_TX_2),
    ];
    const first = await getConsoleHistory("u1", { limit: 1 });
    expect(first.items.map((i) => i.id)).toEqual(["console:c1"]);
    const second = await getConsoleHistory("u1", { limit: 1, cursor: first.nextCursor });
    expect(second.items.map((i) => i.id)).toEqual(["faucet:f0"]);
    expect(second.nextCursor).toBeNull();
  });

  it("gives no cursor when only hidden claims follow the page", async () => {
    tables.consoleLog = [
      log("c1", "2026-10-02T00:00:05.000Z", "primary-network/local/p-chain_avax_faucet_claim", {
        result: JSON.stringify({ txID: PCHAIN_TX }),
        network: "testnet",
      }),
    ];
    tables.faucetClaim = [claim("f1", "2026-10-02T00:00:00.000Z", PCHAIN_TX, "pchain", null)];
    const page = await getConsoleHistory("u1", { limit: 1 });
    expect(page.items.map((i) => i.id)).toEqual(["console:c1"]);
    expect(page.nextCursor).toBeNull();
  });

  it("fills a page past hidden claims, and bounds the dedup read", async () => {
    const faucetRow = (id: string, iso: string, hash: string) =>
      log(id, iso, "primary-network/local/fuji_c-chain_faucet_claim", {
        result: JSON.stringify({ txHash: hash, chainId: 43113 }),
        network: "testnet",
      });
    const H2 = `0x${"12".repeat(32)}`;
    tables.consoleLog = [
      faucetRow("c2", "2026-10-02T10:00:05.000Z", H2),
      faucetRow("c1", "2026-10-02T09:00:05.000Z", EVM_TX),
    ];
    tables.faucetClaim = [
      claim("f2", "2026-10-02T10:00:00.000Z", H2),
      claim("f1", "2026-10-02T09:00:00.000Z", EVM_TX),
      claim("f0", "2026-10-02T08:00:00.000Z", EVM_TX_2),
    ];
    const first = await getConsoleHistory("u1", { limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual(["console:c2", "console:c1"]);
    const second = await getConsoleHistory("u1", { limit: 2, cursor: first.nextCursor });
    expect(second.items.map((i) => i.id)).toEqual(["faucet:f0"]);
    expect(second.nextCursor).toBeNull();

    const { prisma } = await import("@/prisma/prisma");
    const dedupReads = vi
      .mocked(prisma.consoleLog.findMany)
      .mock.calls.map(([args]) => args as { where: Record<string, unknown>; take?: number })
      .filter((args) => "action_path" in args.where);
    expect(dedupReads.length).toBeGreaterThan(0);
    for (const args of dedupReads) expect(args.take).toBe(200);
  });
});

describe("getConsoleHistory: keyset paging", () => {
  const SAME = "2026-10-02T10:00:00.000Z";

  beforeEach(() => {
    tables.consoleLog = [
      log("c-b", SAME, "a/call/initialize", {}),
      log("c-a", SAME, "a/call/initialize", {}),
      log("c-old", "2026-10-01T00:00:00.000Z", "a/call/initialize", {}),
      log("c-new", "2026-10-03T00:00:00.000Z", "a/call/initialize", {}),
    ];
    tables.faucetClaim = [claim("f-b", SAME, EVM_TX), claim("f-a", SAME, EVM_TX_2)];
    tables.nodeRegistration = [node("n-a", SAME)];
  });

  const ORDER = [
    "console:c-new",
    "console:c-a",
    "console:c-b",
    "faucet:f-a",
    "faucet:f-b",
    "node:n-a",
    "console:c-old",
  ];

  it.each([1, 2, 3, 4, 7])("walks every item once with limit %i, across equal timestamps", async (limit) => {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 20; i++) {
      const page = await getConsoleHistory("u1", { limit, cursor });
      expect(page.items.length).toBeLessThanOrEqual(limit);
      seen.push(...page.items.map((it) => it.id));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual(ORDER);
  });

  it("clamps the page size", async () => {
    expect((await getConsoleHistory("u1", { limit: 0 })).items).toHaveLength(1);
    expect((await getConsoleHistory("u1", { limit: 500 })).items).toHaveLength(7);
    expect((await getConsoleHistory("u1")).items).toHaveLength(7);
  });
});

describe("GET /api/profile/console-history", () => {
  const get = (qs = "") => GET(new NextRequest(`http://localhost/api/profile/console-history${qs}`), {} as never);

  it("returns the session user's page", async () => {
    tables.consoleLog = [
      log("c1", "2026-10-03T00:00:00.000Z", "a/chain_created", {}),
      log("c2", "2026-10-03T00:00:00.000Z", "a/chain_created", {}, "success", "u2"),
    ];
    const res = await get("?limit=5&userId=u2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["console:c1"]);
    expect(body.nextCursor).toBeNull();
  });

  it("answers 400 to a malformed cursor", async () => {
    expect((await get("?cursor=%%%")).status).toBe(400);
    expect((await get(`?cursor=${Buffer.from("[1,2]").toString("base64url")}`)).status).toBe(400);
  });

  it("answers 401 without a session", async () => {
    sessionMock.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });
});
