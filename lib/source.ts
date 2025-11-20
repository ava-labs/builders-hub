import { createMDXSource } from 'fumadocs-mdx/runtime/next';
import {
  type InferMetaType,
  type InferPageType,
  loader,
} from 'fumadocs-core/source';
import { createElement } from 'react';
import { icons } from 'lucide-react';
import { meta, docs, blog as blogs, course, courseMeta, integrations } from '@/.source';
import { openapiPlugin } from 'fumadocs-openapi/server';

export const documentation = loader({
  baseUrl: '/docs',
  icon(icon) {
    if (icon && icon in icons)
      return createElement(icons[icon as keyof typeof icons]);
  },
  plugins: [openapiPlugin() as any],
  source: createMDXSource(docs, meta as any),
});

// Helper function to filter top-level sections only
function filterTopLevelSections(tree: any, shouldIncludeSection: (url: string) => boolean): any {
  if (!Array.isArray(tree)) {
    // If tree is not an array, it might be an object with children
    if (tree && typeof tree === 'object' && 'children' in tree) {
      const filteredChildren = filterTopLevelSections(tree.children, shouldIncludeSection);
      return { ...tree, children: filteredChildren };
    }
    return tree;
  }

  // Filter only at the top level - keep entire branches that match
  return tree
    .filter(node => {
      // Keep separators
      if (!node.url) return true;
      
      // Check if this top-level section should be included
      return shouldIncludeSection(node.url);
    });
}

// Filtered page trees for different doc sections
export function getDocumentationTree() {
  const fullTree = documentation.pageTree;
  return filterTopLevelSections(fullTree, (url) => {
    // Exclude these top-level sections
    return (
      !url.startsWith('/docs/api-reference') &&
      !url.startsWith('/docs/rpcs') &&
      !url.startsWith('/docs/tooling') &&
      !url.startsWith('/docs/acps')
    );
  });
}

export function getApiReferenceTree() {
  const fullTree = documentation.pageTree;
  return filterTopLevelSections(fullTree, (url) => {
    // Only include api-reference section
    return url.startsWith('/docs/api-reference');
  });
}

export function getRpcsTree() {
  const fullTree = documentation.pageTree;
  return filterTopLevelSections(fullTree, (url) => {
    // Only include rpcs section
    return url.startsWith('/docs/rpcs');
  });
}

export function getToolingTree() {
  const fullTree = documentation.pageTree;
  return filterTopLevelSections(fullTree, (url) => {
    // Only include tooling section
    return url.startsWith('/docs/tooling');
  });
}

export function getAcpsTree() {
  const fullTree = documentation.pageTree;
  return filterTopLevelSections(fullTree, (url) => {
    // Only include acps section
    return url.startsWith('/docs/acps');
  });
}

function filterTreeByPrefix(tree: any, prefix: string): any {
  if (!Array.isArray(tree)) {
    if (tree && typeof tree === 'object' && 'children' in tree) {
      const filteredChildren = filterTreeByPrefix(tree.children, prefix);
      return {
        ...tree,
        children: Array.isArray(filteredChildren) ? filteredChildren : [],
      };
    }
    return tree;
  }

  return tree
    .map((node) => {
      const children = node.children ? filterTreeByPrefix(node.children, prefix) : [];
      const normalizedChildren = Array.isArray(children) ? children : [];
      const hasChildren = normalizedChildren.length > 0;
      const matches = typeof node.url === 'string' && node.url.startsWith(prefix);

      if (matches || hasChildren || !node.url) {
        return {
          ...node,
          children: normalizedChildren,
        };
      }

      return null;
    })
    .filter((node) => node !== null);
}

export const academy = loader({
  baseUrl: '/academy',
  icon(icon) {
    if (icon && icon in icons)
      return createElement(icons[icon as keyof typeof icons]);
  },
  source: createMDXSource(course, courseMeta as any),
});

export function getAcademyTree(prefix: string) {
  const fullTree = academy.pageTree;
  if (!prefix) return fullTree;
  return filterTreeByPrefix(fullTree, prefix);
}

export const blog = loader({
  baseUrl: '/blog',
  source: createMDXSource(blogs, []),
});

export const integration = loader({
  baseUrl: '/integrations',
  source: createMDXSource(integrations, []),
});

export type Page = InferPageType<typeof documentation>;
export type Meta = InferMetaType<typeof documentation>;