import type { BlueprintManifest, Registry } from "@/lib/blueprints";
import type { Finding, Severity } from "./audit/types";
import type { StepStates } from "./executor";

/** Testnet network key to its production counterpart. `l1` rebinds to the builder's mainnet L1. */
export const PRODUCTION_COUNTERPARTS: Record<string, string> = {
  "fuji-c-chain": "mainnet-c-chain",
  l1: "l1",
};

/** Promotion needs these fixed or acknowledged; testnet deploys only block on the first two. */
export const PRODUCTION_BLOCKING: readonly Severity[] = ["critical", "high", "medium"];

export interface NetworkMapping {
  networks: Record<string, string>;
  unsupported: { role: string; network: string; reason: string }[];
}

export function productionNetworks(manifest: BlueprintManifest, networks: Record<string, string>, registry: Registry): NetworkMapping {
  const mapped: Record<string, string> = {};
  const unsupported: NetworkMapping["unsupported"] = [];
  for (const [role, network] of Object.entries(networks)) {
    const target = PRODUCTION_COUNTERPARTS[network];
    const allowed = manifest.networks[role]?.allowed ?? [];
    if (!target) {
      unsupported.push({ role, network, reason: `${registry.networks[network]?.name ?? network} has no production counterpart in the registry yet` });
    } else if (!allowed.includes(target)) {
      unsupported.push({ role, network, reason: `the blueprint does not allow ${target} for ${role}` });
    } else if (target !== "l1" && registry.networks[target]?.testnet !== false) {
      unsupported.push({ role, network, reason: `${target} is not a production network` });
    } else {
      mapped[role] = target;
    }
  }
  return { networks: mapped, unsupported };
}

export interface Gate {
  id: "testnet-deployment" | "audit" | "tests" | "networks" | "l1-binding";
  title: string;
  passed: boolean;
  detail: string;
}

export interface GateInput {
  deployment: { stage: string; status: string; steps: StepStates; checks: { passed: boolean; description: string }[] };
  manifest: BlueprintManifest;
  /** The latest audit of the deployment's build, if any. */
  audit: { findings: Finding[]; acknowledged: { fingerprint: string }[] } | null;
  testsConfirmed: boolean;
  mapping: NetworkMapping;
  /** Undefined when the blueprint does not use `l1`. */
  productionL1Bound?: boolean;
}

export function promotionGates(input: GateInput): Gate[] {
  const { deployment, audit, mapping } = input;
  const failedChecks = deployment.checks.filter((c) => !c.passed);
  const acked = new Set(audit?.acknowledged.map((a) => a.fingerprint) ?? []);
  const open = audit?.findings.filter((f) => PRODUCTION_BLOCKING.includes(f.severity) && !acked.has(f.fingerprint)) ?? [];

  const gates: Gate[] = [
    {
      id: "testnet-deployment",
      title: "Works on testnet",
      passed: deployment.stage === "testnet" && deployment.status === "succeeded" && failedChecks.length === 0,
      detail:
        deployment.stage !== "testnet"
          ? "Only a testnet deployment can be promoted."
          : deployment.status !== "succeeded"
            ? `The testnet deployment is ${deployment.status}.`
            : failedChecks.length
              ? `Failing checks: ${failedChecks.map((c) => c.description).join("; ")}.`
              : "Every step landed and every check passed.",
    },
    {
      id: "audit",
      title: "Audit is clean",
      passed: !!audit && open.length === 0,
      detail: !audit
        ? "Run the audit on this build first."
        : open.length
          ? `${open.length} critical, high or medium finding${open.length === 1 ? "" : "s"} still open.`
          : "No open critical, high or medium findings.",
    },
    {
      id: "tests",
      title: "Tests pass",
      passed: input.testsConfirmed,
      detail: input.testsConfirmed ? "The builder confirmed forge test passes." : "Run forge test on the exported project and confirm it passes.",
    },
    {
      id: "networks",
      title: "Production networks exist",
      passed: mapping.unsupported.length === 0,
      detail: mapping.unsupported.length
        ? mapping.unsupported.map((u) => `${u.role}: ${u.reason}`).join("; ")
        : Object.entries(mapping.networks)
            .map(([role, network]) => `${role} → ${network}`)
            .join(", "),
    },
  ];
  if (input.productionL1Bound !== undefined) {
    gates.push({
      id: "l1-binding",
      title: "Mainnet L1 is bound",
      passed: input.productionL1Bound,
      detail: input.productionL1Bound ? "The project's production L1 is a known mainnet chain." : "Bind your mainnet L1 in the Production tab.",
    });
  }
  return gates;
}

export const allPassed = (gates: Gate[]) => gates.every((g) => g.passed);
