import type { Folder, Node, Root } from 'fumadocs-core/page-tree';
import { moduleHeads } from '@/lib/academy/course-outline';

/** The number before a module heading in the sidebar (spec 4.3), mono in the secondary grey. */
export function ModuleNumber({ value }: { value: string }) {
  return (
    <span data-academy-part="module-number" className="mr-2 font-ac-mono text-[11px] font-normal text-ac-ink-3">
      {value}
    </span>
  );
}

function numberCourse(course: Folder): Folder {
  const numbers = new Map<Node, string>(moduleHeads(course).map(({ head, number }) => [head, number]));
  if (numbers.size === 0) return course;
  return {
    ...course,
    children: course.children.map((node) => {
      const number = numbers.get(node);
      if (number === undefined || node.type === 'page') return node;
      // A long name wraps beside its number, as the round 8 stills show; the number stays whole.
      return { ...node, name: <><ModuleNumber value={number} />{' '}{node.name}</> };
    }),
  };
}

function numberNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== 'folder') return node;
    return node.root ? numberCourse(node) : { ...node, children: numberNodes(node.children) };
  });
}

/**
 * The page tree with each module heading (separator, or plain folder) led by its outline number.
 * fumadocs renders a heading's name as given (SidebarSeparator and the folder row), so the
 * sidebar, the mobile drawer and their spacing stay fumadocs' own.
 */
export function withModuleNumbers(tree: Root): Root {
  return { ...tree, children: numberNodes(tree.children) };
}
