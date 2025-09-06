import { replaceRelativeLinks } from '../shared.mts';

export type TransformFunction = (content: string, meta: TransformMeta) => string;

export interface TransformMeta {
  title: string;
  description:string;
  sourceBaseUrl: string;
  editUrl?: string;
}

export function createParser(transforms: TransformFunction[]): (content: string, meta: TransformMeta) => string {
  return (content: string, meta: TransformMeta): string => {
    return transforms.reduce((acc, transform) => transform(acc, meta), content);
  };
}

// Transformation Fns
export const addFrontmatter: TransformFunction = (content, meta) => {
  const frontmatter = `---
title: "${meta.title.replace(/"/g, '\\"')}"
description: "${meta.description.replace(/"/g, '\\"')}"
edit_url: ${meta.editUrl || ''}
---

`;
  return frontmatter + content.replace(/^---[\s\S]*?---/, '').trim();
};

export const removeFirstHeading: TransformFunction = (content) => {
  return content.replace(/^#\s+.+\n/, '');
};

export const fixRelativeLinks: TransformFunction = (content, meta) => {
  return replaceRelativeLinks(content, meta.sourceBaseUrl);
};

export const fixGitHubMarkdown: TransformFunction = (content) => {
  return content
    .replace(/>\s*\[NOTE\]\s*(.*?)$/gm, ':::note\n$1\n:::')
    .replace(/>\s*\[TIP\]\s*(.*?)$/gm, ':::tip\n$1\n:::')
    .replace(/^:::(\s*note|tip|warning|info|caution)\s*$/gm, ':::$1')
    .replace(/(?<!\[)!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" />')
    .replace(/^!!!\s+(\w+)\s*\n/gm, ':::$1\n')
    .replace(/^!!\s+(\w+)\s*\n/gm, '::$1\n')
    .replace(/^!([^[{].*?)$/gm, '$1')
    .replace(/<!--(.*?)-->/g, '{/* $1 */}');
};

export const fixMalformedHTML: TransformFunction = (content) => {
  let fixed = content;
  fixed = fixed
    .replace(/<img([^>]*?)>/gi, (match, attrs) => {
      if (match.endsWith('/>')) return match;
      return `<img${attrs} />`;
    })
    .replace(/<br>/g, '<br />');
  return fixed;
};

export const aggressivelyFixMalformedHTML: TransformFunction = (content) => {
  return content
    // Fix tags with spaces, like < / div >
    .replace(/<\s*\/\s*([\w]+)\s*>/g, '</$1>')
    // Fix self-closing tags with spaces, like < br / >
    .replace(/<\s*([\w]+)\s*\/\s*>/g, '<$1 />');
};

export const mdxifyStyleTags: TransformFunction = (content) => {
  return content.replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
    // If it's already using the MDX block syntax, leave it alone
    if (css.trim().startsWith('{`')) {
      return match;
    }
    // Otherwise, wrap it
    const escapedCss = css.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return `<style>{\`${escapedCss}\`}</style>`;
  });
};

export const fixCodeBlockLanguage: TransformFunction = (content) => {
  return content.replace(/```golang/g, '```go');
};

export const removeInvalidClosingTags: TransformFunction = (content) => {
  return content.replace(/<\/img>/g, '');
};

export const fixDetailsTags: TransformFunction = (content) => {
  let fixed = content;

  // Forcefully ensure that details, summary, and closing details tags
  // are treated as block-level elements by wrapping them in newlines.
  // This is an aggressive approach to fix stubborn MDX parsing errors.
  fixed = fixed
    .replace(/(<details[^>]*>)/gi, '\n\n$1\n\n')
    .replace(/(<\/details>)/gi, '\n\n$1\n\n')
    .replace(/(<summary>[\s\S]*?<\/summary>)/gi, '\n\n$1\n\n');

  // Clean up any excessive newlines created by this process.
  fixed = fixed.replace(/\n{3,}/g, '\n\n');

  return fixed;
};

export const convertAngleBracketLinks: TransformFunction = (content) => {
  // Finds raw http links inside angle brackets and converts them to markdown links.
  // e.g., <http://example.com> -> [http://example.com](http://example.com)
  return content.replace(/<((https?:\/\/[^\s>]+))>/g, '[$2]($1)');
};

export const fixUnicodeMathSymbols: TransformFunction = (content) => {
  return content
    // Replace mathematical comparison operators (Unicode)
    .replace(/≤/g, '&lt;=')
    .replace(/≥/g, '&gt;=')
    .replace(/≠/g, '!=')
    .replace(/≈/g, '~=')
    .replace(/≡/g, '===')
    // Replace bidirectional arrows (Unicode and ASCII)
    .replace(/↔/g, '&lt;-&gt;')
    .replace(/⇔/g, '&lt;=&gt;')
    .replace(/\s<>\s/g, ' &lt;-&gt; ')
    .replace(/\s<->\s/g, ' &lt;-&gt; ')
    // Replace ASCII comparison operators that can cause MDX issues
    .replace(/([^<>=!])<=/g, '$1&lt;=')
    .replace(/([^<>=!])>=/g, '$1&gt;=')
    // Fix table formatting issues with backslashes and asterisks
    .replace(/\\\*/g, '\\\\*')
    // Replace other common mathematical symbols that might cause MDX issues
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/∞/g, 'infinity')
    .replace(/∆/g, 'Delta')
    .replace(/∇/g, 'nabla');
};


// Pipelines
export const basePipeline: TransformFunction[] = [
  addFrontmatter,
  removeFirstHeading,
  fixRelativeLinks,
];

export const defaultPipeline: TransformFunction[] = [
  ...basePipeline,
  fixGitHubMarkdown,
  fixMalformedHTML,
];

export const primaryNetworkPipeline: TransformFunction[] = [
  mdxifyStyleTags,
  fixCodeBlockLanguage,
  ...defaultPipeline,
];

export const crossChainPipeline: TransformFunction[] = [
  removeInvalidClosingTags,
  ...defaultPipeline,
];

export const sdksPipeline: TransformFunction[] = [
  fixDetailsTags,
  ...defaultPipeline,
];

export const acpsPipeline: TransformFunction[] = [
  aggressivelyFixMalformedHTML,
  convertAngleBracketLinks,
  fixUnicodeMathSymbols,
  fixCodeBlockLanguage,
  ...defaultPipeline,
];
