import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { academy, getAcademyTree } from '@/lib/source';
import { LayoutWrapper } from '@/app/layout-wrapper.client';
import { AcademyDocsLayoutWrapper } from './layout-wrapper.client';
import './critical.css';
import './styles.css';

// Handwritten font for onboarding tooltip - loaded globally to prevent FOUT
import { Caveat } from 'next/font/google';

const handwrittenFont = Caveat({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-handwritten',
  display: 'swap',
});

export default function Layout({ children }: { children: ReactNode }) {
  const defaultTree = academy.pageTree;
  const avalancheTree = getAcademyTree('/academy/avalanche-l1');
  const blockchainTree = getAcademyTree('/academy/blockchain');
  const entrepreneurTree = getAcademyTree('/academy/entrepreneur');

  return (
    <LayoutWrapper baseOptions={baseOptions}>
      <div className={handwrittenFont.variable}>
        <AcademyDocsLayoutWrapper
          defaultTree={defaultTree}
          avalancheTree={avalancheTree}
          blockchainTree={blockchainTree}
          entrepreneurTree={entrepreneurTree}
        >
          {children}
        </AcademyDocsLayoutWrapper>
      </div>
    </LayoutWrapper>
  );
}
