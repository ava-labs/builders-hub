import { describe, expect, it } from "vitest";
import { embedSections } from "@/utils/remote-content/shared.mts";

const META = {
  contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/evm/imp/cchain/",
  embedContentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/evm/imp/vmconfig/",
  embedSourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/evm/imp/vmconfig/config.md",
};

const PAGE = `Intro.

## Shared Options

See the [shared configuration](../vmconfig/config.md):

- [APIs](../vmconfig/config.md#apis)

## Warp

Back to [the APIs](../vmconfig/config.md#apis) and the [shared options](../vmconfig/config.md).
`;

const EMBEDDED = `> **Note**: Shared by the [C-Chain](../cchain/config.md).

Intro of the shared file.

## APIs

| Option | Default |
|--------|---------|
| \`apis\` | see [Available APIs](#available-apis) and [Go](https://pkg.go.dev/time) |

### Available APIs

\`\`\`sh
## not a heading
\`\`\`
`;

describe("embedSections", () => {
  const out = embedSections(PAGE, EMBEDDED, META);

  it("replaces the section body with the embedded sections one level deeper", () => {
    expect(out).toContain("## Shared Options\n\n### APIs\n");
    expect(out).toContain("#### Available APIs");
    expect(out).toContain("## not a heading");
    expect(out).toContain("\n## Warp\n");
    expect(out).not.toContain("See the [shared configuration]");
    expect(out).not.toContain("Intro of the shared file.");
  });

  it("points links to the embedded file at the embedded headings", () => {
    expect(out).toContain("Back to [the APIs](#apis) and the [shared options](#shared-options).");
    expect(out).toContain("[Available APIs](#available-apis)");
    expect(out).toContain("[Go](https://pkg.go.dev/time)");
  });

  it("finds the section by its link, not its heading", () => {
    const renamed = embedSections(PAGE.replace("## Shared Options", "## Common Options"), EMBEDDED, META);
    expect(renamed).toContain("## Common Options\n\n### APIs\n");
    expect(renamed).toContain("[shared options](#common-options)");
  });

  it("leaves a page that doesn't link to the embedded file unchanged", () => {
    const page = "Intro.\n\n## Warp\n\nSee [the docs](https://build.avax.network/docs).\n";
    expect(embedSections(page, EMBEDDED, META)).toBe(page);
  });
});
