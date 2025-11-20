import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { academy, getAcademyTree } from '@/lib/source';
import { LayoutWrapper } from '@/app/layout-wrapper.client';
import { AcademyDocsLayoutWrapper } from './layout-wrapper.client';
import './styles.css';

export default function Layout({ children }: { children: ReactNode }) {
  const defaultTree = academy.pageTree;
  const avalancheTree = getAcademyTree('/academy/avalanche-l1');
  const blockchainTree = getAcademyTree('/academy/blockchain');
  const entrepreneurTree = getAcademyTree('/academy/entrepreneur');

  return (
    <LayoutWrapper baseOptions={baseOptions}>
      <AcademyDocsLayoutWrapper
        defaultTree={defaultTree}
        avalancheTree={avalancheTree}
        blockchainTree={blockchainTree}
        entrepreneurTree={entrepreneurTree}
      >
        {children}
      </AcademyDocsLayoutWrapper>
    </LayoutWrapper>
  );
}
