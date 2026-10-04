import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import {
  getDocumentationTree,
  getApiReferenceTree,
  getRpcsTree,
  getToolingTree,
  getAcpsTree
} from '@/lib/source';
import { DocsLayoutWrapper } from './docs-layout-wrapper';
import { LayoutWrapper } from '@/app/layout-wrapper.client';
import 'fumadocs-twoslash/twoslash.css';
import './critical.css';
import './styles.css';
import './book/tokens.css';
import './book/sidebar.css';
import './book/callout.css';
import './book/code.css';
import './book/colorkey.css';
import './book/figure.css';
import './book/mermaid.css';
import './book/print.css';

export default function Layout({ children }: { children: ReactNode }) {
  // Generate all filtered trees server-side
  const documentationTree = getDocumentationTree();
  const apiReferenceTree = getApiReferenceTree();
  const rpcsTree = getRpcsTree();
  const toolingTree = getToolingTree();
  const acpsTree = getAcpsTree();

  return (
    <LayoutWrapper baseOptions={baseOptions}>
      <DocsLayoutWrapper
        documentationTree={documentationTree}
        apiReferenceTree={apiReferenceTree}
        rpcsTree={rpcsTree}
        toolingTree={toolingTree}
        acpsTree={acpsTree}
      >
        {children}
      </DocsLayoutWrapper>
    </LayoutWrapper>
  );
}
