// Hardhat ships compiled bytecode with library placeholders of the form
// `__$<34-hex-hash>__` and a `linkReferences` map describing each placeholder's
// byte offset. We substitute in deployed library addresses using the offsets
// (rather than string replace) to avoid the miniscule risk of accidentally
// matching a non-placeholder `__$...__` substring.

import type { Hex } from './types';

export interface HardhatLinkReferences {
  // { "<sol file>": { "<lib name>": [{ start, length }, ...] } }
  [solFile: string]: {
    [libName: string]: { start: number; length: number }[];
  };
}

/**
 * Splice deployed library addresses into Solidity bytecode.
 *
 * @param bytecode The original bytecode with `__$<hash>__` placeholders.
 * @param linkReferences Hardhat's link map from the artifact.
 * @param libraries Map from `<sol>:<name>` (or just `<name>`) to deployed address.
 */
export function linkLibraries(
  bytecode: Hex,
  linkReferences: HardhatLinkReferences | undefined,
  libraries: Record<string, Hex>,
): Hex {
  if (!linkReferences) return bytecode;
  let linked = bytecode.slice(2); // strip 0x
  for (const [solFile, libs] of Object.entries(linkReferences)) {
    for (const [libName, refs] of Object.entries(libs)) {
      const key = `${solFile}:${libName}`;
      const addr = libraries[key] ?? libraries[libName];
      if (!addr) throw new Error(`No address provided for library ${key}`);
      const stripped = addr.toLowerCase().replace(/^0x/, '').padStart(40, '0');
      for (const ref of refs) {
        const cStart = ref.start * 2;
        const cEnd = cStart + ref.length * 2;
        linked = linked.slice(0, cStart) + stripped + linked.slice(cEnd);
      }
    }
  }
  return `0x${linked}` as Hex;
}
