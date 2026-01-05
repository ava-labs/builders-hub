"use client"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Colors, FIREWOOD_PALETTE } from "./types"
import { LSMProblemDiagram } from "./LSMCompaction"
import { DatabaseRace } from "./DatabaseRace"
import { AddressVsHashDiagram } from "./TrieNativeStorage"
import { KeyFeatures, ComparisonTable } from "./KeyFeatures"
import { FAQ } from "./FAQ"

// Firewood logo - a stylized tree/wood icon
function FirewoodLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Tree trunk */}
      <rect x="17" y="22" width="6" height="14" rx="1" fill={FIREWOOD_PALETTE.walnut} />
      {/* Tree crown layers */}
      <path d="M20 4L28 16H12L20 4Z" fill={FIREWOOD_PALETTE.forest} />
      <path d="M20 8L26 18H14L20 8Z" fill={FIREWOOD_PALETTE.moss} />
      <path d="M20 12L24 20H16L20 12Z" fill={FIREWOOD_PALETTE.sage} />
      {/* Ember accent */}
      <circle cx="20" cy="34" r="2" fill={FIREWOOD_PALETTE.ember} />
    </svg>
  )
}

export function FirewoodLanding() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [domTheme, setDomTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    setMounted(true)
    const isDarkClass = document.documentElement.classList.contains('dark')
    setDomTheme(isDarkClass ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    if (!mounted) return

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const isDarkClass = document.documentElement.classList.contains('dark')
          setDomTheme(isDarkClass ? 'dark' : 'light')
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [mounted])

  const isDark = !mounted || domTheme === 'dark' || (domTheme === undefined && (resolvedTheme === "dark" || resolvedTheme === undefined))

  // Firewood theme colors - warm wood tones
  const colors: Colors = isDark ? {
    // Dark mode - charcoal with warm wood accents
    bg: "bg-[#1a1410]",
    text: "text-[#e8dfd4]",
    textMuted: "text-[#b09a85]",
    textFaint: "text-[#6b5d4d]",
    border: "border-[#3d3027]",
    borderStrong: "border-[#5c4a3d]",
    blockBg: "bg-[#251e18]",
    blockBgStrong: "bg-[#2f261e]",
    blockSolid: "bg-[#e8dfd4]",
    blockFaint: "bg-[#3d3027]",
    stroke: "#b09a85",
    wood: "#b08968",
    woodLight: "#d4a574",
    accent: "#e85d04",
  } : {
    // Light mode - warm parchment with wood accents
    bg: "bg-[#faf7f2]",
    text: "text-[#2d2419]",
    textMuted: "text-[#7c5c4a]",
    textFaint: "text-[#b09a85]",
    border: "border-[#d4c4b0]",
    borderStrong: "border-[#b09a85]",
    blockBg: "bg-[#f5efe6]",
    blockBgStrong: "bg-[#ebe3d6]",
    blockSolid: "bg-[#2d2419]",
    blockFaint: "bg-[#d4c4b0]",
    stroke: "#7c5c4a",
    wood: "#b08968",
    woodLight: "#d4a574",
    accent: "#e85d04",
  }

  return (
    <div
      className={`relative w-full min-h-screen ${colors.bg} flex flex-col items-center justify-center p-4 md:p-12 overflow-x-hidden`}
    >
      {/* Subtle wood grain texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <div className="text-center mb-4 md:mb-16 max-w-5xl w-full mx-auto px-2 relative z-10">
        <div className="mb-3 md:mb-5">
          <FirewoodLogo className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" />
        </div>
        <h1
          className={`text-xl sm:text-2xl md:text-4xl font-semibold ${colors.text} tracking-wide mb-3 md:mb-5`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          Firewood
        </h1>
        <p className={`text-xs sm:text-sm md:text-base ${colors.textMuted} tracking-wide mb-4 md:mb-6`}>
          Compaction-Free Merkle Trie Storage for the EVM
        </p>

        {/* Links */}
        <div className="flex flex-row gap-2 sm:gap-3 justify-center items-center">
          <a
            href="https://github.com/ava-labs/firewood"
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border ${colors.border} ${colors.blockBg} hover:border-[#b08968] transition-all rounded-sm`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-60 group-hover:opacity-100 transition-opacity shrink-0 sm:w-4 sm:h-4">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <span className={`text-[10px] sm:text-xs ${colors.text} tracking-wide`}>GitHub</span>
          </a>

          <a
            href="https://docs.rs/firewood"
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border ${colors.border} ${colors.blockBg} hover:border-[#b08968] transition-all rounded-sm`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-60 group-hover:opacity-100 transition-opacity shrink-0 sm:w-4 sm:h-4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className={`text-[10px] sm:text-xs ${colors.text} tracking-wide`}>Documentation</span>
          </a>
        </div>
      </div>

      <div className="w-full max-w-5xl relative z-10">
        {/* Problem statement hook */}
        <div className="pb-6 mb-6 md:-mt-4 md:pb-10 md:mb-10">
          <p className={`text-sm sm:text-base ${colors.textMuted} leading-relaxed`}>
            EVM state is a Merkle trie. Traditional databases flatten it into key-value pairs and run constant background compaction.
          </p>
          <p className={`text-sm sm:text-base mt-2 md:mt-3 font-medium`} style={{ color: FIREWOOD_PALETTE.oak }}>
            What if the database understood the trie structure natively?
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: THE PROBLEM */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12 md:mb-24">
          <div className="flex items-center gap-4 mb-4 md:mb-6">
            <span
              className="text-sm font-mono font-bold px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: FIREWOOD_PALETTE.ember + '20', color: FIREWOOD_PALETTE.ember }}
            >
              01
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
            <span className={`text-sm uppercase tracking-widest ${colors.text} font-medium`}>The Problem</span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
          </div>

          <div className="overflow-hidden md:overflow-visible mb-8">
            <div className="md:transform-none origin-top-left transform scale-[0.55] sm:scale-[0.75] md:scale-100 w-[182%] sm:w-[133%] md:w-full">
              <LSMProblemDiagram colors={colors} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: THE SOLUTION */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12 md:mb-24">
          <div className="flex items-center gap-4 mb-4 md:mb-6">
            <span
              className="text-sm font-mono font-bold px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: FIREWOOD_PALETTE.moss + '20', color: FIREWOOD_PALETTE.moss }}
            >
              02
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
            <span className={`text-sm uppercase tracking-widest ${colors.text} font-medium`}>The Solution</span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
          </div>

          <div className="overflow-hidden md:overflow-visible mb-8">
            <div className="md:transform-none origin-top-left transform scale-[0.55] sm:scale-[0.75] md:scale-100 w-[182%] sm:w-[133%] md:w-full">
              <DatabaseRace colors={colors} />
            </div>
          </div>

          <div className="overflow-hidden md:overflow-visible mt-8">
            <div className="md:transform-none origin-top-left transform scale-[0.55] sm:scale-[0.75] md:scale-100 w-[182%] sm:w-[133%] md:w-full">
              <AddressVsHashDiagram colors={colors} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: KEY FEATURES */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12 md:mb-24">
          <div className="flex items-center gap-4 mb-4 md:mb-6">
            <span
              className="text-sm font-mono font-bold px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: FIREWOOD_PALETTE.oak + '20', color: FIREWOOD_PALETTE.oak }}
            >
              03
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
            <span className={`text-sm uppercase tracking-widest ${colors.text} font-medium`}>Key Features</span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
          </div>

          <div className="overflow-hidden md:overflow-visible mb-8">
            <div className="md:transform-none origin-top-left transform scale-[0.55] sm:scale-[0.75] md:scale-100 w-[182%] sm:w-[133%] md:w-full">
              <KeyFeatures colors={colors} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: COMPARISON */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12 md:mb-24">
          <div className="flex items-center gap-4 mb-4 md:mb-6">
            <span
              className="text-sm font-mono font-bold px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: FIREWOOD_PALETTE.maple + '20', color: FIREWOOD_PALETTE.walnut }}
            >
              04
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
            <span className={`text-sm uppercase tracking-widest ${colors.text} font-medium`}>Comparison</span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
          </div>

          <div className="overflow-hidden md:overflow-visible">
            <div className="md:transform-none origin-top-left transform scale-[0.55] sm:scale-[0.75] md:scale-100 w-[182%] sm:w-[133%] md:w-full">
              <ComparisonTable colors={colors} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* FAQ SECTION */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <FAQ colors={colors} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* GET STARTED */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-8 pb-12 md:pt-12 md:pb-16">
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
            <span className={`text-sm uppercase tracking-widest ${colors.text} font-medium`}>Get Started</span>
            <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
          </div>

          <div className="flex flex-row gap-2 sm:gap-4 justify-center items-stretch">
            <a
              href="https://github.com/ava-labs/firewood"
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border ${colors.border} ${colors.blockBg} hover:border-[#b08968] transition-all rounded-sm`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-60 group-hover:opacity-100 transition-opacity shrink-0 sm:w-5 sm:h-5">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <div className="text-left">
                <div className={`text-[9px] sm:text-xs uppercase tracking-wider ${colors.textMuted}`}>Source Code</div>
                <div className={`text-xs sm:text-sm ${colors.text}`}>GitHub Repo</div>
              </div>
            </a>

            <a
              href="https://docs.rs/firewood"
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border ${colors.border} ${colors.blockBg} hover:border-[#b08968] transition-all rounded-sm`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-60 group-hover:opacity-100 transition-opacity shrink-0 sm:w-5 sm:h-5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div className="text-left">
                <div className={`text-[9px] sm:text-xs uppercase tracking-wider ${colors.textMuted}`}>API Reference</div>
                <div className={`text-xs sm:text-sm ${colors.text}`}>docs.rs</div>
              </div>
            </a>

            <a
              href="https://crates.io/crates/firewood"
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border ${colors.border} ${colors.blockBg} hover:border-[#b08968] transition-all rounded-sm`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-60 group-hover:opacity-100 transition-opacity shrink-0 sm:w-5 sm:h-5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <div className="text-left">
                <div className={`text-[9px] sm:text-xs uppercase tracking-wider ${colors.textMuted}`}>Rust Package</div>
                <div className={`text-xs sm:text-sm ${colors.text}`}>crates.io</div>
              </div>
            </a>
          </div>

          {/* Code snippet */}
          <div className="mt-8">
            <div className={`text-[10px] ${colors.textMuted} uppercase tracking-wider mb-2`}>
              Quick Start
            </div>
            <div
              className="p-4 font-mono text-sm overflow-x-auto rounded-sm"
              style={{
                backgroundColor: isDark ? FIREWOOD_PALETTE.coal : FIREWOOD_PALETTE.parchment,
                border: `1px solid ${colors.wood}30`
              }}
            >
              <pre className={colors.text}>
                <span className={colors.textMuted}># Add to Cargo.toml</span>{'\n'}
                <span style={{ color: FIREWOOD_PALETTE.moss }}>firewood</span> = <span style={{ color: FIREWOOD_PALETTE.ember }}>&quot;0.0.18&quot;</span>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
