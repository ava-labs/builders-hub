import { describe, expect, it } from "vitest";
import {
  ACADEMY_TRACKS,
  coursesInOrder,
  courseUrl,
  getAcademyTrack,
  twoDigits,
  visibleAcademyTracks,
} from "@/components/academy/shared/academy-tracks";
import type { AcademyPathType } from "@/components/academy/shared/academy-types";
import { avalancheLearningPaths } from "@/components/academy/learning-path-configs/avalanche.config";
import { blockchainLearningPaths } from "@/components/academy/learning-path-configs/blockchain.config";
import { team1LearningPaths } from "@/components/academy/learning-path-configs/team1.config";

const ids = (attrs: readonly string[] | null | undefined, active: AcademyPathType) =>
  visibleAcademyTracks(attrs, active).map((track) => track.id);

describe("academy tracks", () => {
  it("lists the three tracks with their labels, landing hrefs and url segments", () => {
    expect(ACADEMY_TRACKS.map((t) => [t.id, t.label, t.href, t.segment])).toEqual([
      ["avalanche", "Avalanche L1", "/academy/avalanche-l1", "avalanche-l1"],
      ["blockchain", "Blockchain", "/academy/blockchain", "blockchain"],
      ["team1", "Team1", "/academy/team1", "team1"],
    ]);
  });

  it("takes each track's courses from its config array, so counts are never typed", () => {
    expect(getAcademyTrack("avalanche").courses).toBe(avalancheLearningPaths);
    expect(getAcademyTrack("blockchain").courses).toBe(blockchainLearningPaths);
    expect(getAcademyTrack("team1").courses).toBe(team1LearningPaths);
  });

  it("shows Team1 only to team1 tags and devrel, and always on the Team1 landing", () => {
    const publicTracks = ["avalanche", "blockchain"];
    expect(ids(undefined, "avalanche")).toEqual(publicTracks);
    expect(ids([], "blockchain")).toEqual(publicTracks);
    expect(ids(["hackathon-judge"], "blockchain")).toEqual(publicTracks);
    expect(ids(["team1-member"], "avalanche")).toEqual([...publicTracks, "team1"]);
    expect(ids(["devrel"], "avalanche")).toEqual([...publicTracks, "team1"]);
    expect(ids(null, "team1")).toEqual([...publicTracks, "team1"]);
  });

  it("orders courses by mobileOrder, config order breaking ties, without touching the config", () => {
    const before = avalancheLearningPaths.map((node) => node.id);
    expect(coursesInOrder(avalancheLearningPaths).map((node) => node.id)).toEqual([
      "avalanche-fundamentals", "customizing-evm", "interchain-messaging", "erc20-bridge",
      "permissioned-l1s", "l1-native-tokenomics", "permissionless-l1s", "native-token-bridge", "access-restriction",
    ]);
    expect(avalancheLearningPaths.map((node) => node.id)).toEqual(before);
    // x402 Payments and Encrypted ERC both have mobileOrder 4 (blockchain.config.tsx:35, :45).
    expect(coursesInOrder(blockchainLearningPaths).map((node) => node.id).slice(2)).toEqual([
      "x402-payment-infrastructure",
      "encrypted-erc",
    ]);
  });

  it("writes numbers with two digits", () => {
    expect(twoDigits(1)).toBe("01");
    expect(twoDigits(9)).toBe("09");
    expect(twoDigits(12)).toBe("12");
  });

  it("resolves course urls as the tree always has", () => {
    expect(courseUrl("avalanche", "avalanche-l1/avalanche-fundamentals")).toBe("/academy/avalanche-l1/avalanche-fundamentals");
    expect(courseUrl("blockchain", "blockchain/solidity-foundry")).toBe("/academy/blockchain/solidity-foundry");
  });
});
