import { describe, expect, it } from "vitest";
import l1Chains from "@/constants/l1-chains.json";
import { cb58ToHex, hexToCb58, toCb58Id } from "@/lib/studio/l1";

/** How the console's L1 list names Echo. */
const ECHO_CB58 = "98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp";

describe("blockchain ids", () => {
  it("prints a catalog hex id the way the console lists it", () => {
    const echo = (l1Chains as { chainId: string; blockchainId?: string }[]).find((c) => c.chainId === "173750")!;
    expect(hexToCb58(echo.blockchainId!)).toBe(ECHO_CB58);
    expect(cb58ToHex(ECHO_CB58)).toBe(echo.blockchainId!.toLowerCase());
  });

  it("normalizes either form and rejects anything else", () => {
    expect(toCb58Id(ECHO_CB58)).toBe(ECHO_CB58);
    expect(toCb58Id("0x12")).toBeNull();
    expect(toCb58Id("not-an-id")).toBeNull();
  });
});
