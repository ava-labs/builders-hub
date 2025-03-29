import './global.css';
import 'katex/dist/katex.css';
import { PHProvider } from './providers'
import type { Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import type { ReactNode } from 'react';
import { baseUrl, createMetadata } from '@/utils/metadata';
import Chatbot from "@/components/ui/chatbot"
import { PrivacyPolicyBox } from "@/components/privacy-policy"
import { SearchRootProvider } from './searchRootProvider';
import { Banner } from "fumadocs-ui/components/banner";
import "./global.css";
import "katex/dist/katex.css";

export const metadata = createMetadata({
  title: {
    template: "%s | Avalanche Builder Hub",
    default: "Avalanche Builder Hub",
  },
  description:
    "Build your Fast & Interoperable Layer 1 Blockchain with Avalanche.",
  metadataBase: baseUrl,
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: light)", color: "#fff" },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <PHProvider>
        <Banner id="banner" className="border-b border-border"><span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">NEW</span> Register for the <a href="https://lu.ma/avalanchesummitlondonhackathon?utm_source=builder_hub" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-600 transition-colors">London Hackathon</a>!</Banner>
        <body className="flex min-h-screen flex-col">
          <SearchRootProvider>
            {children}
          </SearchRootProvider>
          <Chatbot />
          <div id="privacy-banner-root" className="relative">
            <PrivacyPolicyBox />
          </div>
        </body>
      </PHProvider>
    </html>
  );
}
