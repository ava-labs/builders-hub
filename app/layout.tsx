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
import { CustomCountdownBanner } from "@/components/ui/custom-countdown-banner";
import { HideOnChatPage } from "@/components/layout/chat-page-hider";
import { EmbedModeDetector } from "@/components/layout/embed-mode-detector";
import { ThemeProvider } from "@/components/content-design/theme-observer";

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
        <body className="flex min-h-screen flex-col">
          {/* Detect embed mode and add class to document for CSS targeting */}
          <Suspense fallback={null}>
            <EmbedModeDetector />
          </Suspense>
          <HideOnChatPage>
            <CustomCountdownBanner />
          </HideOnChatPage>
          <Body>
            <ThemeProvider>
              <SearchRootProvider>{children}</SearchRootProvider>
              <HideOnChatPage>
                <div id="privacy-banner-root" className="relative">
                  <PrivacyPolicyBox />
                </div>
              </HideOnChatPage>
            </ThemeProvider>
          </Body>
        </body>
      </PHProvider>
    </html>
  );
}
