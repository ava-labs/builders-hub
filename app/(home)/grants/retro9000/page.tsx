"use client";
import Image from "next/image";
import { Rocket } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

export default function ContactPage() {
  const { resolvedTheme } = useTheme();
  const arrowColor = resolvedTheme === "dark" ? "white" : "black";
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <main className="relative container mx-auto px-4 py-12 space-y-16">
        <section className="text-center space-y-8 pt-8 pb-12">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <Image
                src="/logo-black.png"
                alt="Avalanche Logo"
                width={240}
                height={60}
                className="dark:hidden"
              />
              <Image
                src="/logo-white.png"
                alt="Avalanche Logo"
                width={240}
                height={60}
                className="hidden dark:block"
              />
            </div>
          </div>
          <div className="space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
              Retro9000
              <span className="block text-[#EB4C50] bg-gradient-to-r from-[#EB4C50] to-[#d63384] bg-clip-text flex items-center justify-center gap-4">
                Grants Program
                <Rocket className="w-10 h-10 md:w-14 md:h-14 text-[#EB4C50] animate-pulse stroke-3" />
              </span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Apply for funding to build innovative projects on Avalanche. Join
              our ecosystem and help shape the future of decentralized
              applications.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="bg-[#f4f8fa] dark:bg-gray-900 rounded-3xl overflow-hidden shadow-lg">
              {!iframeLoaded && (
                <div className="flex items-center justify-center h-96">
                  <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              <div
                className={`transition-opacity duration-300 ${iframeLoaded ? "opacity-100" : "opacity-0"} w-full`}
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#EB4C50 #f1f1f1",
                }}
              >
                <iframe
                  src="https://4h8ew.share.hsforms.com/285m6haSPR7-Bh9U7vxvTaQ"
                  width="100%"
                  height="800px"
                  style={{
                    border: "none",
                    backgroundColor: "transparent",
                    margin: "-20px 0",
                    width: "100%",
                    overflow: "auto",
                  }}
                  title="Contact Form"
                  onLoad={handleIframeLoad}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
