import fs from "node:fs";
import path from "node:path";
import {
  decodeAbiParameters,
  decodeDeployData,
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
  type Abi,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";
import { loadBlueprint, loadRegistry } from "@/lib/blueprints";
import {
  PlanError,
  coerceArg,
  encodeCcipExtraArgs,
  evaluateExpectation,
  isComplete,
  outputsFromReceipt,
  pendingStep,
  prepareStep,
  type ArtifactMap,
  type DeploymentContext,
} from "@/lib/studio/executor";
import { cb58ToHex } from "@/lib/studio/l1";
import { allPassed, productionNetworks, promotionGates } from "@/lib/studio/promotion";
import { tar, untar } from "@/lib/studio/tar";

const registry = loadRegistry();
const { manifest } = loadBlueprint("usdc-checkout");
const USDC = registry.networks["fuji-c-chain"].tokens.USDC.address;
const SIGNER = "0x1111111111111111111111111111111111111111";
const STORE = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";

const checkoutAbi = parseAbi([
  "constructor(address usdc, address initialOwner)",
  "function setProduct(uint256 id, string name, uint256 price, bool active)",
  "function transferOwnership(address newOwner)",
  "function purchase(uint256 productId, uint256 quantity, bytes32 memo)",
  "function priceOf(uint256 productId, uint256 quantity) view returns (uint256)",
  "function owner() view returns (address)",
  "event OrderPaid(uint256 indexed orderId, address indexed buyer, uint256 amount)",
]);
const erc20 = JSON.parse(fs.readFileSync(path.join(process.cwd(), "contracts/icm-contracts/compiled/ExampleERC20.json"), "utf8"));
const artifacts: ArtifactMap = {
  USDCCheckout: { abi: checkoutAbi as Abi, bytecode: "0x6080604052" },
  ERC20: { abi: erc20.abi as Abi, bytecode: `0x${erc20.bytecode.object.replace(/^0x/, "")}` as Hex },
};

function context(overrides: Partial<DeploymentContext> = {}): DeploymentContext {
  return { manifest, registry, networks: { main: "fuji-c-chain" }, params: {}, signer: SIGNER, states: {}, ...overrides };
}

const step = (id: string) => manifest.steps.find((s) => s.id === id)!;
const done = (address?: string) => ({ status: "done" as const, address, at: new Date().toISOString() });

describe("executor", () => {
  it("encodes a deploy with registry values and the signer", () => {
    const prepared = prepareStep(context(), step("deploy-checkout"), artifacts);
    expect(prepared.kind).toBe("tx");
    if (prepared.kind !== "tx") return;
    expect(prepared.chainId).toBe(43113);
    expect(prepared.request.to).toBeUndefined();
    const { args } = decodeDeployData({ abi: checkoutAbi, bytecode: "0x6080604052", data: prepared.request.data });
    expect(args).toEqual([USDC, SIGNER]);
  });

  it("resolves later steps from earlier outputs", () => {
    const dc = context({ states: { "deploy-checkout": done(STORE) } });
    expect(pendingStep(dc)?.id).toBe("list-product");
    const prepared = prepareStep(dc, step("list-product"), artifacts);
    if (prepared.kind !== "tx") throw new Error("expected a transaction");
    expect(prepared.request.to).toBe(STORE);
    const call = decodeFunctionData({ abi: checkoutAbi, data: prepared.request.data });
    expect(call).toEqual({ functionName: "setProduct", args: [1n, "Sample product", 5000000n, true] });
  });

  it("skips handing a contract to the wallet that already owns it", () => {
    const dc = context({ states: { "deploy-checkout": done(STORE), "list-product": done() } });
    expect(prepareStep(dc, step("hand-over"), artifacts).kind).toBe("skip");
    const toOther = prepareStep({ ...dc, params: { owner: OTHER } }, step("hand-over"), artifacts);
    expect(toOther.kind).toBe("tx");
  });

  it("uses precompiled artifacts for calls on external tokens", () => {
    const dc = context({ states: { "deploy-checkout": done(STORE), "list-product": done(), "hand-over": done() } });
    const prepared = prepareStep(dc, step("approve-test-purchase"), artifacts);
    if (prepared.kind !== "tx") throw new Error("expected a transaction");
    expect(prepared.request.to).toBe(USDC);
    expect(decodeFunctionData({ abi: erc20.abi as Abi, data: prepared.request.data }).args).toEqual([STORE, 5000000n]);
  });

  it("refuses to plan a step whose references are not known yet", () => {
    expect(() => prepareStep(context(), step("list-product"), artifacts)).toThrow(PlanError);
  });

  it("decodes declared event outputs from a receipt", () => {
    const topics = encodeEventTopics({ abi: checkoutAbi, eventName: "OrderPaid", args: { orderId: 7n, buyer: SIGNER } });
    const data = encodeAbiParameters([{ type: "uint256" }], [5000000n]);
    const outputs = outputsFromReceipt(step("test-purchase"), { logs: [{ address: STORE, topics: topics as Hex[], data }] }, artifacts);
    expect(outputs).toEqual({ orderId: "7" });
    expect(() => outputsFromReceipt(step("test-purchase"), { logs: [] }, artifacts)).toThrow(/OrderPaid/);
  });

  it("evaluates checks against resolved parameters", () => {
    const dc = context();
    const [price, owner] = manifest.checks;
    expect(evaluateExpectation(5000000n, price.expect, dc)).toBe(true);
    expect(evaluateExpectation(4999999n, price.expect, dc)).toBe(false);
    expect(evaluateExpectation(SIGNER.toUpperCase().replace("0X", "0x"), owner.expect, dc)).toBe(true);
    expect(evaluateExpectation(5000000n, { gte: "$param.productPrice" }, dc)).toBe(true);
    expect(evaluateExpectation(0n, { nonZero: true }, dc)).toBe(false);
  });

  it("finishes once required steps are done and optional ones skipped", () => {
    const now = new Date().toISOString();
    const dc = context({
      states: {
        "deploy-checkout": done(STORE),
        "list-product": done(),
        "hand-over": { status: "skipped", at: now },
        "approve-test-purchase": { status: "skipped", at: now },
        "test-purchase": { status: "skipped", at: now },
      },
    });
    expect(isComplete(dc)).toBe(true);
  });

  it("coerces JSON values strictly to ABI types", () => {
    expect(coerceArg("123", { type: "uint256" }, "x")).toBe(123n);
    expect(() => coerceArg("1.5", { type: "uint256" }, "x")).toThrow(PlanError);
    expect(() => coerceArg("0x1234", { type: "address" }, "x")).toThrow(PlanError);
    expect(() => coerceArg("0x12", { type: "bytes32" }, "x")).toThrow(PlanError);
    const tuple = { type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }] } as const;
    expect(coerceArg({ recipient: OTHER, amount: "5" }, tuple, "x")).toEqual({ recipient: OTHER, amount: 5n });
    expect(coerceArg(["1", "2"], { type: "uint64[]" }, "x")).toEqual([1n, 2n]);
  });

  it("encodes CCIP GenericExtraArgsV2", () => {
    const extraArgs = encodeCcipExtraArgs(500000n);
    expect(extraArgs.slice(0, 10)).toBe("0x181dcf10");
    expect(decodeAbiParameters([{ type: "uint256" }, { type: "bool" }], `0x${extraArgs.slice(10)}`)).toEqual([500000n, true]);
  });
});

describe("promotion", () => {
  it("maps Fuji to mainnet and refuses networks without a counterpart", () => {
    expect(productionNetworks(manifest, { main: "fuji-c-chain" }, registry)).toEqual({ networks: { main: "mainnet-c-chain" }, unsupported: [] });
    const ccip = loadBlueprint("ccip-usdc-bridge").manifest;
    const roles = Object.fromEntries(Object.entries(ccip.networks).map(([role, spec]) => [role, spec.default]));
    const mapping = productionNetworks(ccip, roles, registry);
    expect(mapping.unsupported.map((u) => u.network)).toContain("base-sepolia");
  });

  it("opens only when testnet, audit, tests and networks all pass", () => {
    const base = {
      deployment: { stage: "testnet", status: "succeeded", steps: {}, checks: [{ passed: true, description: "ok" }] },
      manifest,
      audit: { findings: [], acknowledged: [] },
      testsConfirmed: true,
      mapping: productionNetworks(manifest, { main: "fuji-c-chain" }, registry),
    };
    expect(allPassed(promotionGates(base))).toBe(true);
    expect(allPassed(promotionGates({ ...base, testsConfirmed: false }))).toBe(false);
    expect(allPassed(promotionGates({ ...base, audit: null }))).toBe(false);
    expect(allPassed(promotionGates({ ...base, deployment: { ...base.deployment, checks: [{ passed: false, description: "owner" }] } }))).toBe(false);

    const medium = {
      detector: "oracle-stale-price",
      severity: "medium" as const,
      fingerprint: "00000000000000aa",
    } as unknown as import("@/lib/studio/audit/types").Finding;
    expect(allPassed(promotionGates({ ...base, audit: { findings: [medium], acknowledged: [] } }))).toBe(false);
    expect(allPassed(promotionGates({ ...base, audit: { findings: [medium], acknowledged: [{ fingerprint: medium.fingerprint }] } }))).toBe(true);
  });
});

describe("helpers", () => {
  it("decodes CB58 blockchain ids and rejects bad checksums", () => {
    const fuji = registry.networks["fuji-c-chain"];
    expect(cb58ToHex(fuji.blockchainId!)).toBe(fuji.blockchainIdHex);
    expect(cb58ToHex(`${fuji.blockchainId!.slice(0, -1)}X`)).toBeNull();
  });

  it("round-trips tar archives, long paths included", () => {
    const long = `project/${"nested/".repeat(20)}Deep.sol`;
    const entries = [
      { path: "project/contracts/A.sol", data: "contract A {}" },
      { path: long, data: "contract Deep {}" },
    ];
    const read = [...untar(tar(entries))].map((e) => ({ path: e.path, data: new TextDecoder().decode(e.data) }));
    expect(read).toEqual(entries);
  });
});
