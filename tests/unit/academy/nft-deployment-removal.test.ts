import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// next.config.mjs wraps its config in fumadocs-mdx's createMDX; the redirects are plain data under it.
vi.mock("fumadocs-mdx/next", () => ({ createMDX: () => (config: unknown) => config }));

import nextConfig from "@/next.config.mjs";
import quizData from "@/components/quizzes/data";
import courses, { getCourseConfig } from "@/content/courses";
import { ACADEMY_COURSES } from "@/components/academy/learning-path-configs/academy.config";
import { firstRedirect, type RedirectRule } from "./helpers/redirects";

const ROOT = process.cwd();
const COURSE_URL = "/academy/blockchain/nft-deployment";
const redirects = (await nextConfig.redirects!()) as RedirectRule[];

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));

describe("NFT Deployment redirects (FDE-154)", () => {
  it.each([COURSE_URL, `${COURSE_URL}/02-prepare-nft-files`, `${COURSE_URL}/certificate`, `${COURSE_URL}/05-token-uris.md`])(
    "%s answers a 308 to /academy",
    (path) => {
      expect(firstRedirect(redirects, path)).toMatchObject({ destination: "/academy", permanent: true });
    },
  );

  it.each([
    "/docs/dapps/deploy-nft-collection/prep-nft-files",
    "/docs/build/dapp/smart-contracts/nfts/deploy-collection",
    "/docs/build/tutorials/smart-digital-assets/wallet-nft-studio",
  ])("the old docs URL %s goes straight to /academy", (path) => {
    expect(firstRedirect(redirects, path)).toMatchObject({ destination: "/academy", permanent: true });
  });

  it("points no redirect into the removed course, and /academy itself does not redirect", () => {
    expect(redirects.filter((rule) => rule.destination.startsWith(COURSE_URL)).map((rule) => rule.source)).toEqual([]);
    expect(firstRedirect(redirects, "/academy")).toBeUndefined();
  });
});

describe("NFT Deployment removal (FDE-154)", () => {
  it("deletes the course pages and drops the course from the Blockchain sidebar", () => {
    expect(existsSync(join(ROOT, "content/academy/blockchain/nft-deployment"))).toBe(false);
    const meta = JSON.parse(readFileSync(join(ROOT, "content/academy/blockchain/meta.json"), "utf8"));
    expect(meta.pages).not.toContain("nft-deployment");
  });

  it("keeps the course out of the merged Academy programme, x402 and Encrypted ERC after Intro to Solidity", () => {
    expect(ACADEMY_COURSES.map((course) => course.id)).not.toContain("nft-deployment");
    expect(ACADEMY_COURSES.filter((course) => course.dependencies.includes("intro-to-solidity")).map((course) => course.id)).toEqual([
      "x402-payment-infrastructure",
      "encrypted-erc",
    ]);
  });

  it("keeps no quiz data for the course", () => {
    expect(Object.keys(quizData.courses)).not.toContain("nft-deployment");
    expect(existsSync(join(ROOT, "components/quizzes/data/courses/nft-deployment.json"))).toBe(false);
  });

  it("no longer issues its certificate or lists it as a course", () => {
    expect(getCourseConfig()["nft-deployment"]).toBeUndefined();
    expect([...courses.official, ...courses.official_featured].map((course) => course.slug)).not.toContain("nft-deployment");
  });

  it("deletes the course's images, which no other page uses", () => {
    expect(readdirSync(join(ROOT, "public/images")).filter((name) => /^nft-(files|collection)\d+\./.test(name))).toEqual([]);
  });

  it("leaves no Academy page that names the course", () => {
    const naming = files(join(ROOT, "content/academy"))
      .filter((file) => /\.mdx?$/.test(file) && /nft[- ]deployment/i.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(ROOT.length + 1));
    expect(naming).toEqual([]);
  });
});
