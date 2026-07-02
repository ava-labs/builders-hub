import "./global.css";
import "katex/dist/katex.css";
import { PHProvider } from "./providers";
import type { Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { baseUrl, createMetadata } from "@/utils/metadata";
import { PrivacyPolicyBox } from "@/components/privacy-policy";
import { SearchRootProvider } from "./searchRootProvider";
import { Body } from "./layout.client";
import { HideOnChatPage } from "@/components/layout/chat-page-hider";
import { EmbedModeDetector } from "@/components/layout/embed-mode-detector";
import { ThemeProvider } from "@/components/content-design/theme-observer";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { UserAvatarProvider } from "@/components/context/UserAvatarContext";
import { ReferralCapture } from "@/components/referrals/ReferralCapture";

export const metadata = createMetadata({
  title: {
    template: "%s | Avalanche Builder Hub",
    default: "Avalanche Builder Hub",
  },
  description:
    "Build your Fast & Interoperable Layer 1 Blockchain with Avalanche.",
  metadataBase: baseUrl,
  alternates: {
    types: {
      'text/plain': [
        { url: '/llms.txt', title: 'LLMs.txt' },
      ],
    },
  },
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
        <body className="flex min-h-screen flex-col" suppressHydrationWarning>
          {/* AI-agent discovery directive: a screen-reader-only link to the
              machine-readable index, rendered server-side at the very top of
              the body so agents find it without parsing <head>. Satisfies the
              Agent Score "llms-txt-directive-html" check, which does not credit
              the <head> <link rel="alternate"> tag. */}
          <a href="/llms.txt" className="sr-only">
            Machine-readable documentation index (llms.txt). Append .md to any
            page URL for its raw markdown.
          </a>
          {/* Detect embed mode and add class to document for CSS targeting */}
          <Suspense fallback={null}>
            <EmbedModeDetector />
          </Suspense>
          <Suspense fallback={null}>
            <ReferralCapture />
          </Suspense>
          <Body>
            <ThemeProvider>
              <UserAvatarProvider>
                <SearchRootProvider>{children}</SearchRootProvider>
              </UserAvatarProvider>
              <HideOnChatPage>
                <div id="privacy-banner-root" className="relative">
                  <PrivacyPolicyBox />
                </div>
              </HideOnChatPage>
              <ChatBubble />
            </ThemeProvider>
          </Body>
        </body>
      </PHProvider>
    </html>
  );
}
