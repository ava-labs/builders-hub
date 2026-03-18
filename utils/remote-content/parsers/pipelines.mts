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

export const fixImageAltText: TransformFunction = (content) => {
  // Fix malformed img tags where alt attribute is placed outside the tag
  // This specific pattern appears in SDK documentation where the alt text is misplaced
  let fixed = content;
  
  // Pattern: <img src="..." /> alt="text" />
  fixed = fixed.replace(/(<img\s+[^>]*?)\s*\/>\s*alt="([^"]*?)"\s*\/>/gi, '$1 alt="$2" />');
  
  // Handle pattern without the trailing />
  fixed = fixed.replace(/(<img\s+[^>]*?)\s*\/>\s*alt="([^"]*?)"\s*(?!\/)/gi, '$1 alt="$2" />');
  
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

export const fixHTMLTags: TransformFunction = (content) => {
  let fixed = content;

  // First, fix any escaped HTML entities in common HTML tags
  fixed = fixed
    // Details and summary tags
    .replace(/&lt;\/summary&gt;/gi, '</summary>')
    .replace(/&lt;summary&gt;/gi, '<summary>')
    .replace(/&lt;\/details&gt;/gi, '</details>')
    .replace(/&lt;details&gt;/gi, '<details>')
    // Text formatting tags
    .replace(/&lt;\/ins&gt;/gi, '</ins>')
    .replace(/&lt;ins&gt;/gi, '<ins>')
    .replace(/&lt;\/del&gt;/gi, '</del>')
    .replace(/&lt;del&gt;/gi, '<del>')
    .replace(/&lt;\/mark&gt;/gi, '</mark>')
    .replace(/&lt;mark&gt;/gi, '<mark>')
    // Heading tags
    .replace(/&lt;\/h([1-6])&gt;/gi, '</h$1>')
    .replace(/&lt;h([1-6])&gt;/gi, '<h$1>')
    // Common inline tags
    .replace(/&lt;\/strong&gt;/gi, '</strong>')
    .replace(/&lt;strong&gt;/gi, '<strong>')
    .replace(/&lt;\/em&gt;/gi, '</em>')
    .replace(/&lt;em&gt;/gi, '<em>')
    .replace(/&lt;\/code&gt;/gi, '</code>')
    .replace(/&lt;code&gt;/gi, '<code>')
    .replace(/&lt;\/a&gt;/gi, '</a>')
    .replace(/&lt;a&gt;/gi, '<a>')
    // Block-level tags
    .replace(/&lt;\/div&gt;/gi, '</div>')
    .replace(/&lt;div&gt;/gi, '<div>')
    .replace(/&lt;\/p&gt;/gi, '</p>')
    .replace(/&lt;p&gt;/gi, '<p>')
    // List tags
    .replace(/&lt;\/ul&gt;/gi, '</ul>')
    .replace(/&lt;ul&gt;/gi, '<ul>')
    .replace(/&lt;\/ol&gt;/gi, '</ol>')
    .replace(/&lt;ol&gt;/gi, '<ol>')
    .replace(/&lt;\/li&gt;/gi, '</li>')
    .replace(/&lt;li&gt;/gi, '<li>');

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

export const convertMermaidBlocks: TransformFunction = (content) => {
  // Convert standard Mermaid code blocks to <Mermaid> component format
  return content.replace(/```mermaid\n([\s\S]*?)\n```/g, (match, diagramContent) => {
    // Escape backticks in the diagram content for the template literal
    const escapedContent = diagramContent.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    
    // Return the Mermaid component with the diagram content
    return `<Mermaid chart={\`${escapedContent}\`} />`;
  });
};

export const escapeJSXExpressions: TransformFunction = (content) => {
  // Escape problematic JSX-like expressions in markdown that cause acorn parsing errors
  // But preserve actual MDX comments and JSX attributes
  let result = content;
  
  // Helper function to check if we're in a code context
  const isInCodeContext = (text: string, offset: number): boolean => {
    // Check if we're inside a code block
    const codeBlockRegex = /```[\s\S]*?```/g;
    let m;
    while ((m = codeBlockRegex.exec(text)) !== null) {
      if (m.index <= offset && offset < m.index + m[0].length) {
        return true;
      }
    }
    
    // Check if we're inside an inline code span
    const beforeCode = text.substring(0, offset);
    const afterCode = text.substring(offset);
    const beforeBackticks = (beforeCode.match(/`/g) || []).length;
    const afterBackticks = (afterCode.match(/`/g) || []).length;
    if (beforeBackticks % 2 === 1) {
      return true;
    }
    
    return false;
  };
  
  // Escape all curly braces that aren't in code contexts or JSX attributes
  result = result.replace(/\{/g, (match, offset) => {
    // Skip if already escaped
    if (offset > 0 && result[offset - 1] === '\\') {
      return match;
    }
    
    // Check if this is inside a JSX attribute (style, className, etc.)
    const beforeMatch = result.substring(Math.max(0, offset - 20), offset);
    if (beforeMatch.match(/\w+=$/)) {
      // This is likely a JSX attribute value, don't escape
      return match;
    }
    
    // Check if we're in a code context
    if (isInCodeContext(result, offset)) {
      return match;
    }
    
    // Check if this starts an MDX comment
    if (result.substring(offset, offset + 3) === '{/*') {
      return match;
    }
    
    return '\\{';
  });
  
  result = result.replace(/\}/g, (match, offset) => {
    // Skip if already escaped (check for preceding \{)
    const beforeMatch = result.substring(Math.max(0, offset - 50), offset);
    if (beforeMatch.includes('\\{') && !beforeMatch.includes('\\}')) {
      // There's an unmatched escaped opening brace, so we should escape this too
    }
    
    // Check if this is inside a JSX attribute (style, className, etc.)
    const beforeMatchShort = result.substring(Math.max(0, offset - 20), offset);
    if (beforeMatchShort.match(/\w+=.*$/)) {
      // This is likely a JSX attribute value, don't escape
      return match;
    }
    
    // Check if we're in a code context
    if (isInCodeContext(result, offset)) {
      return match;
    }
    
    // Check if this ends an MDX comment
    if (result.substring(offset - 2, offset + 1) === '*/}') {
      return match;
    }
    
    return '\\}';
  });
  
  return result;
};

export const escapeGenericTypes: TransformFunction = (content) => {
  // Escape generic type syntax that can cause MDX parsing issues
  // e.g., Record<string, Type> becomes Record&lt;string, Type&gt;
  return content
    // Handle generic types in table cells (but not in code blocks or inline code)
    .replace(/([A-Za-z_][A-Za-z0-9_]*)<([^>]+)>/g, (match, typeName, genericParams, offset) => {
      // Check if we're inside a code block
      const beforeMatch = content.substring(0, offset);
      const afterMatch = content.substring(offset + match.length);
      
      // Count backticks to see if we're in inline code
      const beforeBackticks = (beforeMatch.match(/`/g) || []).length;
      const afterBackticks = (afterMatch.match(/`/g) || []).length;
      if (beforeBackticks % 2 === 1 && afterBackticks % 2 === 1) {
        // We're inside inline code, don't escape
        return match;
      }
      
      // Check if we're in a code block
      const codeBlockRegex = /```[\s\S]*?```/g;
      let isInCodeBlock = false;
      let m;
      while ((m = codeBlockRegex.exec(content)) !== null) {
        if (m.index <= offset && offset < m.index + m[0].length) {
          isInCodeBlock = true;
          break;
        }
      }
      if (isInCodeBlock) {
        return match;
      }
      
      // Check if this looks like an HTML tag (has attributes or is self-closing)
      if (genericParams.includes('=') || match.endsWith('/>')) {
        // This is likely actual HTML/JSX, don't escape
        return match;
      }
      
      // Escape the angle brackets
      return `${typeName}&lt;${genericParams}&gt;`;
    });
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
    // Replace ASCII comparison operators that can cause MDX issues (but not HTML tags)
    .replace(/([^<>=!\w/])<=/g, '$1&lt;=')
    .replace(/([^<>=!\w/])>=/g, '$1&gt;=')
    // Escape < followed by a digit (like <1k) which MDX would try to parse as JSX tag
    .replace(/<(\d)/g, '&lt;$1')
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
  fixImageAltText,
  escapeJSXExpressions,
  escapeGenericTypes,
  fixHTMLTags,
  ...defaultPipeline,
];

export const avalancheL1sPipeline: TransformFunction[] = [
  convertMermaidBlocks,
  ...defaultPipeline,
];

export const acpsPipeline: TransformFunction[] = [
  aggressivelyFixMalformedHTML,
  convertAngleBracketLinks,
  convertMermaidBlocks,
  fixUnicodeMathSymbols,
  fixCodeBlockLanguage,
  ...defaultPipeline,
];