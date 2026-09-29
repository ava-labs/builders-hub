import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerCertificateWebhook } from "@/server/services/hubspotCertificateWebhook";

const fetchMock = vi.fn(async () => new Response("ok"));
/** The webhook urls posted to, in order. */
const posted = () => fetchMock.mock.calls.map((call: unknown[]) => String(call[0]));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("HUBSPOT_WEBHOOK_NFT_DEPLOYMENT", "https://hooks.example/nft-deployment");
  vi.stubEnv("HUBSPOT_WEBHOOK_ENCRYPTED_ERC", "https://hooks.example/encrypted-erc");
  vi.stubEnv("HUBSPOT_WEBHOOK_BLOCKCHAIN_GRADUATION", "https://hooks.example/blockchain-graduation");
});

afterEach(() => {
  fetchMock.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("triggerCertificateWebhook after the NFT Deployment removal (FDE-154)", () => {
  it("sends nothing for nft-deployment, even with its env var still set", async () => {
    await triggerCertificateWebhook("u1", "ada@example.com", "Ada Lovelace", "nft-deployment");
    expect(posted()).toEqual([]);
  });

  it("sends the Blockchain graduation once the four remaining courses are complete", async () => {
    await triggerCertificateWebhook("u1", "ada@example.com", "Ada Lovelace", "encrypted-erc", [
      "blockchain-fundamentals",
      "solidity-foundry",
      "x402-payment-infrastructure",
      "encrypted-erc",
    ]);
    expect(posted()).toEqual(["https://hooks.example/encrypted-erc", "https://hooks.example/blockchain-graduation"]);
  });
});

describe("triggerCertificateWebhook after the Entrepreneur Academy removal (FDE-153)", () => {
  it.each(["foundations-web3-venture", "go-to-market", "web3-community-architect", "fundraising-finance"])(
    "sends nothing for %s, even with the Entrepreneur webhook env vars still set",
    async (courseId) => {
      vi.stubEnv("ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK", "https://hooks.example/entrepreneur-academy");
      vi.stubEnv("CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK", "https://hooks.example/codebase-certificate");
      await triggerCertificateWebhook("u1", "ada@example.com", "Ada Lovelace", courseId);
      expect(posted()).toEqual([]);
    },
  );
});
