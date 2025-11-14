import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import {
  getDocumentationTree,
  getApiReferenceTree,
  getRpcsTree,
  getToolingTree,
  getAcpsTree,
  getTemplatesTree
} from '@/lib/source';
import { DocsLayoutWrapper } from './docs-layout-wrapper';
import { LayoutWrapper } from '@/app/layout-wrapper.client';
import 'fumadocs-twoslash/twoslash.css';
import './styles.css';

export default function Layout({ children }: { children: ReactNode }) {
  // Generate all filtered trees server-side
  const documentationTree = getDocumentationTree();
  const apiReferenceTree = getApiReferenceTree();
  const rpcsTree = getRpcsTree();
  const toolingTree = getToolingTree();
  const acpsTree = getAcpsTree();
  const templatesTree = getTemplatesTree();

  return (
    <LayoutWrapper baseOptions={baseOptions}>
      <DocsLayoutWrapper
        documentationTree={documentationTree}
        apiReferenceTree={apiReferenceTree}
        rpcsTree={rpcsTree}
        toolingTree={toolingTree}
        acpsTree={acpsTree}
        templatesTree={templatesTree}
      >
        {children}
      </DocsLayoutWrapper>
    </LayoutWrapper>
  );
}
