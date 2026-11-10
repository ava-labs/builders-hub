import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeEmoji } from "../../../utils/remote-content/parsers/pipelines.mts";

// The AvalancheGo and subnet-evm docs hold no emoji. The SDK, API reference and tooling docs may.
// The remote pages (yarn build:remote) land in these folders too, and the pipeline strips their emoji.
const FOLDERS = ["nodes", "rpcs", "primary-network", "avalanche-l1s"].map((folder) =>
  join(process.cwd(), "content/docs", folder),
);
// The same rule as tests/unit/academy/sidebar-emoji.test.ts: RGI_Emoji covers keycaps and flags, and leaves out
// text symbols such as the trademark sign.
const PICTOGRAPH = new RegExp("\\p{RGI_Emoji}", "v");
const meta = { title: "", description: "", sourceBaseUrl: "" };

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe("AvalancheGo and subnet-evm docs", () => {
  it("hold no emoji", () => {
    const found = FOLDERS.flatMap(files)
      .filter((file) => /\.(mdx|json)$/.test(file))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, i) => (PICTOGRAPH.test(line) ? [`${file.slice(process.cwd().length + 1)}:${i + 1}`] : [])),
      );
    expect(found).toEqual([]);
  });
});

describe("removeEmoji", () => {
  it("removes an emoji and the space after it", () => {
    expect(removeEmoji("> **⚠️ WARNING: set it to `false`.**", meta)).toBe("> **WARNING: set it to `false`.**");
    expect(removeEmoji("block ⚠️ **Warning**: only", meta)).toBe("block **Warning**: only");
  });

  it("keeps the line break after an emoji and keeps text symbols", () => {
    expect(removeEmoji("Done 🚀\nNext ✓ → ™", meta)).toBe("Done \nNext ✓ → ™");
  });
});
