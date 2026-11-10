import "server-only";
import { createPublicClient, getAddress, http, type Address, type PublicClient } from "viem";
import l1ChainsData from "@/constants/l1-chains.json";
import { loadRegistry, type NetworkEntry } from "@/lib/blueprints";
import { DEFAULT_PRECOMPILES, type DeploymentJob, type DeploymentResult } from "@/lib/quick-l1/types";
import { cb58ToHex, toCb58Id } from "@/lib/studio/l1";
import { knownChain } from "@/lib/verification/chains";
import { prisma } from "@/prisma/prisma";
import type { BindL1Input } from "@/types/studio";
import { StudioError } from "./errors";
import { getOwnedProject } from "./projects";

/*
 * The server only talks to RPC endpoints it chose: the registry's, the L1
 * catalog's, or a managed node the builder owns, all recorded server-side
 * when the L1 was bound. A URL from the client is never used.
 */

export type RuntimeBindings = Partial<Record<"testnet" | "production", Record<string, Partial<NetworkEntry>>>>;

/** A bound L1. `relayer` is set when Quick L1 was asked for a managed relayer and it never came up. */
export type L1Binding = Partial<NetworkEntry> & { relayer?: "not-running" };

type LaunchedL1 = Pick<DeploymentResult, "rpcUrl" | "evmChainId" | "blockchainId" | "subnetId"> & {
  explorer?: { url: string };
  interop?: { icmRegistryAddress: string | null };
};

const clients = new Map<string, PublicClient>();

export function publicClient(rpcUrl: string): PublicClient {
  let client = clients.get(rpcUrl);
  if (!client) {
    client = createPublicClient({ transport: http(rpcUrl, { timeout: 15_000, retryCount: 1 }) });
    clients.set(rpcUrl, client);
  }
  return client;
}

/** eth_chainId with a short timeout, to find which server-known endpoint serves a chain. */
export async function probeChainId(rpcUrl: string): Promise<number | null> {
  return createPublicClient({ transport: http(rpcUrl, { timeout: 5_000, retryCount: 0 }) })
    .getChainId()
    .catch(() => null);
}

/** The RPC for a network key, from the registry or the project's server-recorded runtime binding. */
export function rpcUrlOf(networkKey: string, runtime: Record<string, Partial<NetworkEntry>> | undefined): string {
  const registry = loadRegistry();
  const url = registry.networks[networkKey]?.rpcUrl ?? runtime?.[networkKey]?.rpcUrl;
  if (!url) {
    throw new StudioError(
      409,
      networkKey === "l1" ? "Bind your L1 first: under Networks for testnet, in the Production tab for mainnet" : `Bind ${networkKey} first`,
    );
  }
  return url;
}

interface CatalogEntry {
  chainId: string;
  chainName?: string;
  blockchainId?: string;
  subnetId?: string;
  rpcUrl?: string;
  explorerUrl?: string;
  isTestnet?: boolean;
}

type SourceEntry = Partial<NetworkEntry> & { name?: string };

function nodeEntry(node: { chain_name: string | null; rpc_url: string; blockchain_id: string; subnet_id: string }): SourceEntry {
  return { name: node.chain_name ?? "Your L1", rpcUrl: node.rpc_url, blockchainId: node.blockchain_id, subnetId: node.subnet_id, testnet: true };
}

function catalogEntry(chainId: number, stage: "testnet" | "production"): SourceEntry | null {
  const known = knownChain(chainId);
  const catalog = (l1ChainsData as CatalogEntry[]).find((c) => Number(c.chainId) === chainId);
  if (!known || !catalog) return null;
  if (known.isTestnet !== (stage === "testnet")) {
    throw new StudioError(400, stage === "testnet" ? "Bind a testnet L1 for testnet work" : "Production needs a mainnet L1");
  }
  return {
    name: known.name,
    rpcUrl: known.rpcUrl,
    blockchainId: catalog.blockchainId ? toCb58Id(catalog.blockchainId) : null,
    subnetId: catalog.subnetId ?? null,
    explorerUrl: catalog.explorerUrl ?? null,
    testnet: known.isTestnet,
  };
}

async function saveBinding(projectId: string, runtime: RuntimeBindings, stage: "testnet" | "production", binding: Partial<NetworkEntry>) {
  const next: RuntimeBindings = { ...runtime, [stage]: { ...(runtime[stage] ?? {}), l1: binding } };
  await prisma.studioProject.update({ where: { id: projectId }, data: { runtime: next as object } });
}

/** Binds the project's `l1` role for a stage to a chain the server can vouch for. */
export async function bindL1(userId: string, projectId: string, input: BindL1Input) {
  const project = await getOwnedProject(userId, projectId);
  const registry = loadRegistry();
  const { source } = input;
  let entry: SourceEntry | null = null;
  let expectedChainId: number | undefined;

  if (source.kind === "node") {
    if (input.stage !== "testnet") throw new StudioError(400, "Managed nodes run on Fuji; bind a mainnet L1 from the L1 registry");
    const node = await prisma.nodeRegistration.findFirst({ where: { id: source.nodeId, user_id: userId, status: "active" } });
    if (!node) throw new StudioError(404, "No active managed node with that id");
    entry = nodeEntry(node);
  } else if (source.kind === "catalog") {
    entry = catalogEntry(source.chainId, input.stage);
    if (!entry) throw new StudioError(404, "That chain is not in the Builder Hub L1 registry");
    expectedChainId = source.chainId;
  } else {
    // An L1 from the browser's console list: only its id is taken from the client, never its RPC.
    const node =
      input.stage === "testnet"
        ? await prisma.nodeRegistration.findFirst({ where: { user_id: userId, status: "active", blockchain_id: source.blockchainId } })
        : null;
    if (node) {
      entry = nodeEntry(node);
    } else {
      entry = catalogEntry(source.evmChainId, input.stage);
      if (entry?.blockchainId && entry.blockchainId !== source.blockchainId) entry = null;
      expectedChainId = source.evmChainId;
    }
    if (!entry) {
      throw new StudioError(
        400,
        "Studio can use this L1 once Builder Hub runs its node (Quick L1 or a managed testnet node) or lists it in the L1 registry.",
        "l1_unvouched",
      );
    }
  }

  const client = publicClient(entry.rpcUrl!);
  const evmChainId = await client.getChainId().catch(() => {
    throw new StudioError(502, "The L1's RPC did not answer eth_chainId");
  });
  if (expectedChainId !== undefined && evmChainId !== expectedChainId) throw new StudioError(502, "The L1's RPC reports a different chain ID");

  const blockchainIdHex = entry.blockchainId ? cb58ToHex(entry.blockchainId) : null;
  if (entry.blockchainId && !blockchainIdHex) throw new StudioError(400, "The L1's blockchain ID is not valid CB58");

  const messenger = (registry.networks.l1.teleporter?.messenger ?? undefined) as Address | undefined;
  const messengerCode = messenger ? await client.getCode({ address: messenger }).catch(() => undefined) : undefined;
  let teleporterRegistry: Address | null = null;
  if (input.teleporterRegistry) {
    const code = await client.getCode({ address: getAddress(input.teleporterRegistry) }).catch(() => undefined);
    if (!code || code === "0x") throw new StudioError(400, "No contract at that Teleporter registry address on the L1");
    teleporterRegistry = getAddress(input.teleporterRegistry);
  }

  const binding: Partial<NetworkEntry> = {
    ...entry,
    evmChainId,
    blockchainIdHex,
    teleporter: { messenger: messengerCode && messengerCode !== "0x" ? messenger! : null, registry: teleporterRegistry } as NetworkEntry["teleporter"],
  };
  await saveBinding(project.id, (project.runtime ?? {}) as RuntimeBindings, input.stage, binding);
  return binding;
}

/**
 * Records a launched Quick L1 chain as the project's testnet L1: from our own
 * service's result, or from the chain itself when only the managed relayer
 * failed, which is the one way a failed job gets here.
 */
export async function bindQuickL1Result(projectId: string, job: DeploymentJob, result: LaunchedL1 | undefined = job.result) {
  if (!result) throw new StudioError(500, "The Quick L1 job finished without a result");
  const interop = job.request.precompiles?.interoperability ?? DEFAULT_PRECOMPILES.interoperability;
  const messenger = loadRegistry().networks.l1.teleporter?.messenger ?? null;
  const binding: L1Binding = {
    name: job.request.chainName,
    rpcUrl: result.rpcUrl,
    evmChainId: result.evmChainId,
    blockchainId: result.blockchainId,
    blockchainIdHex: cb58ToHex(result.blockchainId),
    subnetId: result.subnetId,
    explorerUrl: result.explorer?.url ?? null,
    testnet: true,
    nativeCurrency: { symbol: job.request.tokenSymbol, decimals: 18 },
    teleporter: { messenger: interop ? messenger : null, registry: result.interop?.icmRegistryAddress ?? null } as NetworkEntry["teleporter"],
    ...(job.status === "failed" && job.request.enableManagedRelayer && !job.completedSteps.includes("starting-relayer")
      ? { relayer: "not-running" as const }
      : {}),
  };
  const project = await prisma.studioProject.findUniqueOrThrow({ where: { id: projectId }, select: { id: true, runtime: true } });
  await saveBinding(project.id, (project.runtime ?? {}) as RuntimeBindings, "testnet", binding);
  return binding;
}

/** Adds a registry deployed after launch to the project's bound L1, so blueprints that read `$net.l1.teleporter.registry` resolve it. */
export async function recordRegistry(projectId: string, stage: "testnet" | "production", registry: string) {
  const project = await prisma.studioProject.findUniqueOrThrow({ where: { id: projectId }, select: { id: true, runtime: true } });
  const runtime = (project.runtime ?? {}) as RuntimeBindings;
  const l1 = runtime[stage]?.l1;
  if (!l1) return;
  const teleporter = { messenger: l1.teleporter?.messenger ?? null, registry: getAddress(registry) } as NetworkEntry["teleporter"];
  await saveBinding(project.id, runtime, stage, { ...l1, teleporter });
}

/** The builder says a relayer now serves the bound L1; Studio has no way to see relayers itself. */
export async function markRelayerRunning(userId: string, projectId: string, stage: "testnet" | "production") {
  const project = await getOwnedProject(userId, projectId);
  const runtime = (project.runtime ?? {}) as RuntimeBindings;
  const l1 = runtime[stage]?.l1 as L1Binding | undefined;
  if (!l1) throw new StudioError(404, "No L1 is bound for that stage");
  const { relayer: _cleared, ...rest } = l1;
  await saveBinding(project.id, runtime, stage, rest);
}

export async function unbindL1(userId: string, projectId: string, stage: "testnet" | "production") {
  const project = await getOwnedProject(userId, projectId);
  const runtime = (project.runtime ?? {}) as RuntimeBindings;
  const { l1: _removed, ...rest } = runtime[stage] ?? {};
  await prisma.studioProject.update({ where: { id: project.id }, data: { runtime: { ...runtime, [stage]: rest } as object } });
}
