import { remark } from 'remark';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import { getDefaultMDXOptions } from 'fumadocs-mdx/config';
import type { StructuredData } from 'fumadocs-core/mdx-plugins';
import { remarkPlugins } from '@/lib/mdx-remark-plugins';

/**
 * The search text (structuredData) of a page in an async collection (docs, integrations),
 * without a compile.
 *
 * page.data.load() compiles the whole page (remark, rehype with shiki, the JS output) and
 * runs it, only to read structuredData. remarkStructure makes that value in the remark
 * stage, so this module runs the remark stage of the same compile and stops there:
 * remark-parse, remark-mdx, the unravel step of @mdx-js/mdx, then the fumadocs preset with
 * the plugins of source.config.ts. remarkImage is off because image sizes never reach the
 * search text, and it would fetch every remote image.
 */
const presetPlugins = getDefaultMDXOptions({ remarkPlugins, remarkImageOptions: false }).remarkPlugins ?? [];

const isBlank = (value: string) => /^[\t\n\f\r ]*$/.test(value);

// @mdx-js/mdx 3.1.1 (lib/plugin/remark-mark-and-unravel.js, MIT) runs this before any remark
// plugin: a paragraph that holds only JSX or expressions becomes flow content, which changes
// what remarkStructure indexes. The rest of that plugin only sets flags for the JS output.
function remarkUnravel() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const unravel =
        node.children.some((child) => child.type === 'mdxJsxTextElement' || child.type === 'mdxTextExpression') &&
        node.children.every(
          (child) =>
            child.type === 'mdxJsxTextElement' ||
            child.type === 'mdxTextExpression' ||
            (child.type === 'text' && isBlank(child.value)),
        );
      if (!unravel) return;
      const flow: unknown[] = [];
      for (const child of node.children) {
        if (child.type === 'mdxJsxTextElement') flow.push({ ...child, type: 'mdxJsxFlowElement' });
        else if (child.type === 'mdxTextExpression') flow.push({ ...child, type: 'mdxFlowExpression' });
        else if (!(child.type === 'text' && /^[\t\r\n ]+$/.test(child.value))) flow.push(child);
      }
      parent.children.splice(index, 1, ...(flow as Root['children']));
      return index;
    });
  };
}

const processors = {
  mdx: remark().use(remarkMdx).use(remarkUnravel).use(presetPlugins).freeze(),
  md: remark().use(remarkUnravel).use(presetPlugins).freeze(),
};

// The frontmatter pattern of fumadocs-mdx (fumaMatter), so the remark stage sees the same text.
const frontmatter = /^---\r?\n(.+?)\r?\n---\r?\n/s;

interface AsyncPage {
  data: {
    info: { fullPath: string };
    getText(type: 'raw'): Promise<string>;
    load(): Promise<{ structuredData: StructuredData }>;
  };
}

export async function getStructuredData(page: AsyncPage): Promise<StructuredData> {
  const raw = await page.data.getText('raw');
  // <include> needs the remarkInclude step of fumadocs-mdx, which only the compile runs.
  if (raw.includes('<include')) return (await page.data.load()).structuredData;

  const match = frontmatter.exec(raw);
  const value = match ? raw.slice(match[0].length) : raw;
  const processor = page.data.info.fullPath.endsWith('.mdx') ? processors.mdx : processors.md;
  // remarkStructure adds the _openapi search text of the API reference pages from the frontmatter.
  const file = { value, path: page.data.info.fullPath, data: { frontmatter: page.data } };
  return new Promise((resolve, reject) => {
    processor.run(processor.parse(value), file, (error, _tree, result) => {
      if (error || !result) reject(error ?? new Error(`No result for ${page.data.info.fullPath}`));
      else resolve(result.data.structuredData as StructuredData);
    });
  });
}
