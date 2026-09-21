import { describe, expect, it } from "vitest";
import { readInitializedState } from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/initializedState";

const ADDRESS = "0x1111111111111111111111111111111111111111" as const;
const ABI = [] as const;

function clientReturning(value: unknown) {
  return { readContract: async () => value };
}

describe("readInitializedState", () => {
  it("is null while owner() is the zero address: uninitialized and renounced read alike", async () => {
    const client = clientReturning("0x0000000000000000000000000000000000000000");
    await expect(readInitializedState(client, ADDRESS, ABI)).resolves.toBeNull();
  });

  it("is true once owner() is a real address, regardless of case", async () => {
    const client = clientReturning("0xC60B683D1835B72A1f3CdAE3ac29b49607F0176D");
    const lowercased = clientReturning("0xc60b683d1835b72a1f3cdae3ac29b49607f0176d");
    await expect(readInitializedState(client, ADDRESS, ABI)).resolves.toBe(true);
    await expect(readInitializedState(lowercased, ADDRESS, ABI)).resolves.toBe(true);
  });

  it("asks for owner(), never for a function the ABI lacks", async () => {
    const calls: string[] = [];
    const client = { readContract: async (args: { functionName: string }) => { calls.push(args.functionName); return "0x0000000000000000000000000000000000000000"; } };
    await readInitializedState(client, ADDRESS, ABI);
    expect(calls).toEqual(["owner"]);
  });

  it("propagates read errors so the caller can fall back", async () => {
    const client = { readContract: async () => { throw new Error("not a contract"); } };
    await expect(readInitializedState(client, ADDRESS, ABI)).rejects.toThrow("not a contract");
  });
});
