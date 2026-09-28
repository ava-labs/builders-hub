type TreeNode = { url?: unknown; children?: unknown };

/**
 * True when `b` holds exactly the same items, in the same order, as `a`.
 * Items are compared by reference, so an array rebuilt out of untouched
 * nodes still counts as "the same items".
 */
function sameItems(a: unknown[] | undefined, b: unknown[]): boolean {
  if (!Array.isArray(a)) return b.length === 0;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * Keep only the nodes whose `url` starts with `prefix` (plus separators and
 * any folder that still has surviving children).
 *
 * Identity matters here: the academy layout hands four filtered trees and the
 * unfiltered tree to the client in one Flight payload. Nodes that survive the
 * filter untouched are returned by reference, so React serialises each shared
 * subtree once and back-references it afterwards. Rebuilding every node with a
 * spread, as this did before, made each tree a fresh graph and shipped the same
 * course listings several times over.
 *
 * Never mutates the input: a node is either returned as-is or replaced by a
 * new object with new children.
 */
export function filterTreeByPrefix<T>(tree: T, prefix: string): T {
  if (!Array.isArray(tree)) {
    if (tree && typeof tree === 'object' && 'children' in tree) {
      const node = tree as TreeNode;
      const filteredChildren = filterTreeByPrefix(node.children, prefix);
      const normalized = Array.isArray(filteredChildren) ? filteredChildren : [];
      if (sameItems(node.children as unknown[] | undefined, normalized)) return tree;
      return { ...(tree as object), children: normalized } as T;
    }
    return tree;
  }

  return (tree as TreeNode[])
    .map((node) => {
      const filtered = node.children ? filterTreeByPrefix(node.children, prefix) : [];
      const normalized = Array.isArray(filtered) ? (filtered as unknown[]) : [];
      const hasChildren = normalized.length > 0;
      const matches = typeof node.url === 'string' && node.url.startsWith(prefix);

      if (!(matches || hasChildren || !node.url)) return null;
      if (sameItems(node.children as unknown[] | undefined, normalized)) return node;
      return { ...node, children: normalized };
    })
    .filter((node) => node !== null) as unknown as T;
}
